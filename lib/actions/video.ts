"use server";

import { tasks, auth as triggerAuth } from "@trigger.dev/sdk/v3";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createVideoClips,
  createVideoProject as dbCreateVideoProject,
  deleteVideoProject as dbDeleteVideoProject,
  getMusicTracks as dbGetMusicTracks,
  getUserWithWorkspace,
  getVideoProjectById,
  updateClipSequenceOrders,
  updateVideoClip,
  updateVideoProject,
} from "@/lib/db/queries";
import type {
  NewVideoClip,
  VideoAspectRatio,
  VideoRoomType,
} from "@/lib/db/schema";
import {
  deleteVideoProjectFiles,
  getExtensionFromContentType,
  getVideoSourceImagePath,
  uploadVideoSourceImage,
} from "@/lib/supabase";
import { getMotionPrompt } from "@/lib/video/motion-prompts";
import {
  calculateVideoCost,
  costToCents,
  VIDEO_DEFAULTS,
} from "@/lib/video/video-constants";
import type { generateVideoTask } from "@/trigger/video-orchestrator";

// ============================================================================
// Types
// ============================================================================

export interface CreateVideoInput {
  name: string;
  aspectRatio?: VideoAspectRatio;
  musicTrackId?: string | null;
  musicVolume?: number;
  generateNativeAudio?: boolean;
  provider?: "fal" | "xai"; // AI provider for video generation
  clips: Array<{
    sourceImageUrl: string;
    imageGenerationId?: string | null;
    endImageUrl?: string | null;
    endImageGenerationId?: string | null;
    roomType: VideoRoomType;
    roomLabel?: string | null;
    sequenceOrder: number;
    durationSeconds?: number;
    transitionType?: "cut" | "seamless";
  }>;
}

export interface UpdateClipInput {
  clipId: string;
  roomType?: VideoRoomType;
  roomLabel?: string | null;
  motionPrompt?: string | null;
  endImageUrl?: string | null;
  endImageGenerationId?: string | null;
  transitionType?: "cut" | "seamless";
}

// ============================================================================
// Actions
// ============================================================================

export async function createVideoProject(input: CreateVideoInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userData = await getUserWithWorkspace(session.user.id);
  if (!userData) {
    throw new Error("User or workspace not found");
  }

  const { user, workspace } = userData;

  // Calculate estimated cost
  const estimatedCost = costToCents(
    calculateVideoCost(
      input.clips.length,
      VIDEO_DEFAULTS.CLIP_DURATION,
      input.generateNativeAudio ?? VIDEO_DEFAULTS.GENERATE_NATIVE_AUDIO
    )
  );

  // Create video project
  const videoProject = await dbCreateVideoProject({
    workspaceId: workspace.id,
    userId: user.id,
    name: input.name,
    aspectRatio: input.aspectRatio ?? VIDEO_DEFAULTS.ASPECT_RATIO,
    musicTrackId: input.musicTrackId ?? null,
    musicVolume: input.musicVolume ?? VIDEO_DEFAULTS.MUSIC_VOLUME,
    generateNativeAudio:
      input.generateNativeAudio ?? VIDEO_DEFAULTS.GENERATE_NATIVE_AUDIO,
    status: "draft",
    clipCount: input.clips.length,
    completedClipCount: 0,
    estimatedCost,
    thumbnailUrl: null,
    errorMessage: null,
    metadata: {
      provider: input.provider ?? "fal",
    },
    description: "",
    finalVideoUrl: null,
    durationSeconds: null,
    triggerRunId: null,
    triggerAccessToken: null,
    actualCost: 0,
  });

  // Create clips
  const clipsData: Omit<NewVideoClip, "id" | "createdAt" | "updatedAt">[] =
    input.clips.map((clip) => ({
      videoProjectId: videoProject.id,
      sourceImageUrl: clip.sourceImageUrl,
      imageGenerationId: clip.imageGenerationId ?? null,
      endImageUrl: clip.endImageUrl ?? null,
      endImageGenerationId: clip.endImageGenerationId ?? null,
      roomType: clip.roomType,
      roomLabel: clip.roomLabel ?? null,
      sequenceOrder: clip.sequenceOrder,
      motionPrompt: getMotionPrompt(clip.roomType),
      transitionType: clip.transitionType ?? "seamless",
      durationSeconds: clip.durationSeconds ?? VIDEO_DEFAULTS.CLIP_DURATION,
      status: "pending",
    }));

  await createVideoClips(clipsData);

  revalidatePath("/video");

  return { success: true, videoProjectId: videoProject.id };
}

export async function triggerVideoGeneration(videoProjectId: string) {
  if (process.env.DEBUG_VIDEO === "1") {
    console.log(
      `[triggerVideoGeneration] Starting trigger for project: ${videoProjectId}`
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    if (process.env.DEBUG_VIDEO === "1") {
      console.error("[triggerVideoGeneration] Unauthorized: No session found");
    }
    throw new Error("Unauthorized");
  }

  const projectData = await getVideoProjectById(videoProjectId);
  if (!projectData) {
    if (process.env.DEBUG_VIDEO === "1") {
      console.error(
        `[triggerVideoGeneration] Video project not found: ${videoProjectId}`
      );
    }
    throw new Error("Video project not found");
  }

  // Verify ownership
  const userData = await getUserWithWorkspace(session.user.id);
  if (
    !userData ||
    projectData.videoProject.workspaceId !== userData.workspace.id
  ) {
    if (process.env.DEBUG_VIDEO === "1") {
      console.error(
        `[triggerVideoGeneration] Unauthorized: User does not own workspace ${projectData.videoProject.workspaceId}`
      );
    }
    throw new Error("Unauthorized");
  }

  try {
    // Check if TRIGGER_SECRET_KEY is set (without logging its value)
    if (process.env.DEBUG_VIDEO === "1") {
      if (process.env.TRIGGER_SECRET_KEY) {
        console.log("[triggerVideoGeneration] TRIGGER_SECRET_KEY is present");
      } else {
        console.error(
          "[triggerVideoGeneration] TRIGGER_SECRET_KEY is not set in environment variables"
        );
      }

      // Trigger the video generation task using the recommended tasks.trigger method
      console.log(
        "[triggerVideoGeneration] Calling tasks.trigger for generate-video..."
      );
    }

    const handle = await tasks.trigger<typeof generateVideoTask>(
      "generate-video",
      {
        videoProjectId,
      },
      {
        queue: "video-generation",
      }
    );

    if (!handle?.id) {
      if (process.env.DEBUG_VIDEO === "1") {
        console.error(
          "[triggerVideoGeneration] Trigger failed: No run ID returned from Trigger.dev"
        );
      }
      throw new Error("Failed to start video generation: No run ID returned");
    }

    if (process.env.DEBUG_VIDEO === "1") {
      console.log(
        `[triggerVideoGeneration] Trigger successful! Run ID: ${handle.id}`
      );

      // Generate public access token for real-time updates
      console.log("[triggerVideoGeneration] Creating public access token...");
    }

    const publicAccessToken = await triggerAuth.createPublicToken({
      scopes: {
        read: { runs: [handle.id] },
      },
    });

    // Update project with run ID AND access token for real-time tracking
    await updateVideoProject(videoProjectId, {
      status: "generating",
      triggerRunId: handle.id,
      triggerAccessToken: publicAccessToken,
    });

    if (process.env.DEBUG_VIDEO === "1") {
      console.log(
        `[triggerVideoGeneration] Project ${videoProjectId} updated with run ID and access token`
      );
    }

    // Create invoice line item for video generation billing
    try {
      const { createVideoInvoiceLineItemAction } = await import(
        "@/lib/actions/billing"
      );
      await createVideoInvoiceLineItemAction(
        projectData.videoProject.workspaceId,
        videoProjectId,
        projectData.videoProject.name
      );
    } catch (billingError) {
      // Log but don't fail the video generation if billing fails
      console.error(
        "[triggerVideoGeneration] Failed to create invoice line item:",
        billingError
      );
    }

    revalidatePath(`/video/${videoProjectId}`);

    return { success: true, runId: handle.id };
  } catch (error) {
    console.error(
      "[triggerVideoGeneration] Error triggering video generation:",
      error
    );

    // Update project status to failed if triggering failed
    await updateVideoProject(videoProjectId, {
      status: "failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Failed to trigger video generation",
    });

    throw error;
  }
}

export async function updateVideoSettings(
  videoProjectId: string,
  data: {
    name?: string;
    aspectRatio?: VideoAspectRatio;
    musicTrackId?: string | null;
    musicVolume?: number;
    generateNativeAudio?: boolean;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const projectData = await getVideoProjectById(videoProjectId);
  if (!projectData) {
    throw new Error("Video project not found");
  }

  // Verify ownership
  const userData = await getUserWithWorkspace(session.user.id);
  if (
    !userData ||
    projectData.videoProject.workspaceId !== userData.workspace.id
  ) {
    throw new Error("Unauthorized");
  }

  await updateVideoProject(videoProjectId, data);

  revalidatePath(`/video/${videoProjectId}`);

  return { success: true };
}

export async function updateClip(input: UpdateClipInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Update motion prompt if room type changed
  const updateData: Parameters<typeof updateVideoClip>[1] = {};

  if (input.roomType) {
    updateData.roomType = input.roomType;
    updateData.motionPrompt =
      input.motionPrompt ?? getMotionPrompt(input.roomType);
  }

  if (input.roomLabel !== undefined) {
    updateData.roomLabel = input.roomLabel;
  }

  if (input.motionPrompt !== undefined) {
    updateData.motionPrompt = input.motionPrompt;
  }

  if (input.endImageUrl !== undefined) {
    updateData.endImageUrl = input.endImageUrl;
  }

  if (input.endImageGenerationId !== undefined) {
    updateData.endImageGenerationId = input.endImageGenerationId;
  }

  if (input.transitionType !== undefined) {
    updateData.transitionType = input.transitionType;
  }

  await updateVideoClip(input.clipId, updateData);

  return { success: true };
}

export async function reorderClips(
  videoProjectId: string,
  clipOrders: Array<{ id: string; sequenceOrder: number }>
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const projectData = await getVideoProjectById(videoProjectId);
  if (!projectData) {
    throw new Error("Video project not found");
  }

  // Verify ownership
  const userData = await getUserWithWorkspace(session.user.id);
  if (
    !userData ||
    projectData.videoProject.workspaceId !== userData.workspace.id
  ) {
    throw new Error("Unauthorized");
  }

  await updateClipSequenceOrders(clipOrders);

  revalidatePath(`/video/${videoProjectId}`);

  return { success: true };
}

export async function deleteVideoProject(videoProjectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const projectData = await getVideoProjectById(videoProjectId);
  if (!projectData) {
    throw new Error("Video project not found");
  }

  // Verify ownership
  const userData = await getUserWithWorkspace(session.user.id);
  if (
    !userData ||
    projectData.videoProject.workspaceId !== userData.workspace.id
  ) {
    throw new Error("Unauthorized");
  }

  // Delete files from storage
  try {
    await deleteVideoProjectFiles(
      projectData.videoProject.workspaceId,
      videoProjectId
    );
  } catch (error) {
    console.error("Failed to delete video files:", error);
    // Continue with database deletion even if file deletion fails
  }

  // Delete from database (cascades to clips)
  await dbDeleteVideoProject(videoProjectId);

  revalidatePath("/video");

  return { success: true };
}

export async function getMusicTracks(category?: string) {
  return dbGetMusicTracks({ category, activeOnly: true });
}

export async function retryFailedClip(clipId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Import here to avoid circular dependency
  const { generateVideoClipTask } = await import(
    "@/trigger/generate-video-clip"
  );

  // Reset clip status and trigger regeneration
  await updateVideoClip(clipId, {
    status: "pending",
    errorMessage: null,
    clipUrl: null,
  });

  const handle = await generateVideoClipTask.trigger({ clipId });

  await updateVideoClip(clipId, {
    status: "processing",
    metadata: { runId: handle.id },
  });

  return { success: true, runId: handle.id };
}

export async function getVideoProjectWithClips(videoProjectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const projectData = await getVideoProjectById(videoProjectId);
  if (!projectData) {
    return null;
  }

  // Verify ownership
  const userData = await getUserWithWorkspace(session.user.id);
  if (
    !userData ||
    projectData.videoProject.workspaceId !== userData.workspace.id
  ) {
    return null;
  }

  return projectData;
}

// Upload a video source image to Supabase storage
export async function uploadVideoSourceImageAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userData = await getUserWithWorkspace(session.user.id);
  if (!userData) {
    throw new Error("User or workspace not found");
  }

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  // Validate file type
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please use JPEG, PNG, or WebP images.");
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("File too large. Maximum size is 10MB.");
  }

  // Generate unique ID for the image
  const imageId = crypto.randomUUID();
  const extension = getExtensionFromContentType(file.type);
  const path = getVideoSourceImagePath(
    userData.workspace.id,
    `${imageId}.${extension}`
  );

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Upload to Supabase
  const publicUrl = await uploadVideoSourceImage(buffer, path, file.type);

  return { success: true, url: publicUrl, imageId };
}
