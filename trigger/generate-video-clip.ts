import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import {
  getVideoClipById,
  updateVideoClip,
  updateVideoProjectCounts,
} from "@/lib/db/queries";
import type { VideoRoomType } from "@/lib/db/schema";
import {
  fal,
  KLING_VIDEO_PRO,
  type KlingVideoInput,
  type KlingVideoOutput,
} from "@/lib/fal";
import type { AIProvider } from "@/lib/providers/types";
import { getVideoPath, uploadVideo } from "@/lib/supabase";
import {
  DEFAULT_NEGATIVE_PROMPT,
  getMotionPrompt,
} from "@/lib/video/motion-prompts";

export interface GenerateVideoClipPayload {
  clipId: string;
  tailImageUrl?: string;
  targetRoomLabel?: string;
  provider?: AIProvider; // Optional, defaults to "fal"
}

export interface VideoClipStatus {
  step:
    | "fetching"
    | "uploading"
    | "generating"
    | "saving"
    | "completed"
    | "failed";
  label: string;
  progress?: number;
}

export const generateVideoClipTask = task({
  id: "generate-video-clip",
  maxDuration: 300, // 5 minutes - Kling can take a while
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  run: async (payload: GenerateVideoClipPayload) => {
    const { clipId, provider = "fal" } = payload;

    try {
      // Step 1: Fetch clip record
      metadata.set("status", {
        step: "fetching",
        label: "Loading clip data…",
        progress: 10,
      } satisfies VideoClipStatus);

      logger.info("Fetching video clip record", { clipId, provider });

      const clip = await getVideoClipById(clipId);
      if (!clip) {
        throw new Error(`Video clip not found: ${clipId}`);
      }

      // Skip if already completed
      if (clip.status === "completed" && clip.clipUrl) {
        logger.info("Clip already processed, skipping", { clipId });
        metadata.set("status", {
          step: "completed",
          label: "Already processed",
          progress: 100,
        } satisfies VideoClipStatus);
        return {
          success: true,
          message: "Already processed",
          clipUrl: clip.clipUrl,
        };
      }

      // Fetch video project to get aspect ratio
      const { getVideoProjectById } = await import("@/lib/db/queries");
      const videoProjectData = await getVideoProjectById(clip.videoProjectId);
      if (!videoProjectData) {
        throw new Error("Video project not found");
      }

      // Update status to processing
      await updateVideoClip(clipId, { status: "processing" });

      // Step 2: Upload source image to Fal.ai storage
      metadata.set("status", {
        step: "uploading",
        label: "Preparing images…",
        progress: 20,
      } satisfies VideoClipStatus);

      logger.info("Fetching source images", {
        clipId,
        sourceImageUrl: clip.sourceImageUrl,
        tailImageUrl: payload.tailImageUrl,
      });

      // Fetch source image
      const imageResponse = await fetch(clip.sourceImageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch source image: ${imageResponse.status}`
        );
      }

      const imageBlob = await imageResponse.blob();
      const falImageUrl = await fal.storage.upload(
        new File([imageBlob], "source.jpg", { type: imageBlob.type })
      );

      logger.info("Uploaded source image to Fal.ai storage", { falImageUrl });

      // Fetch and upload tail image if provided, otherwise use same as source for consistency
      let falTailImageUrl = falImageUrl;
      if (payload.tailImageUrl) {
        logger.info("Fetching tail image", {
          tailImageUrl: payload.tailImageUrl,
        });
        const tailResponse = await fetch(payload.tailImageUrl);
        if (tailResponse.ok) {
          const tailBlob = await tailResponse.blob();
          falTailImageUrl = await fal.storage.upload(
            new File([tailBlob], "tail.jpg", { type: tailBlob.type })
          );
          logger.info("Uploaded tail image to Fal.ai storage", {
            falTailImageUrl,
          });
        } else {
          logger.warn(
            "Failed to fetch tail image, falling back to source image",
            {
              status: tailResponse.status,
            }
          );
        }
      }

      // Step 3: Generate motion prompt
      let motionPrompt =
        clip.motionPrompt ||
        getMotionPrompt(
          clip.roomType as VideoRoomType,
          payload.targetRoomLabel
        );

      // Step 3.5: Handle native audio generation
      const generateAudio = videoProjectData.videoProject.generateNativeAudio;
      if (generateAudio) {
        const track = videoProjectData.musicTrack;
        const roomName = clip.roomLabel || clip.roomType.replace(/-/g, " ");

        let audioPrompt = "";
        if (track) {
          const mood = track.mood ? `${track.mood} ` : "";
          audioPrompt = `Background audio: ${mood}${track.category} music inspired by "${track.name}".`;
        } else {
          audioPrompt = "Background cinematic ambient music.";
        }

        // Add environmental sounds based on room
        const ambientSounds = `Ambient environmental sounds of a ${roomName}.`;

        motionPrompt = `${motionPrompt} ${audioPrompt} ${ambientSounds}`;
      }

      // Step 4: Generate video with AI (provider routing)
      metadata.set("status", {
        step: "generating",
        label: "Generating video…",
        progress: 40,
      } satisfies VideoClipStatus);

      let resultVideoUrl: string;

      if (provider === "xai") {
        // =========================================================
        // xAI Provider: Video generation with polling
        // =========================================================
        logger.info("Using xAI provider for video generation", {
          clipId,
          prompt: motionPrompt,
          duration: clip.durationSeconds || 5,
          aspectRatio: videoProjectData.videoProject.aspectRatio,
        });

        // Import xAI functions dynamically
        const {
          generateVideo: xaiGenerateVideo,
          pollVideoUntilComplete,
          mapAspectRatioToXAI,
        } = await import("@/lib/xai");

        // Map aspect ratio to xAI format
        const xaiAspectRatio = mapAspectRatioToXAI(
          videoProjectData.videoProject.aspectRatio as "16:9" | "9:16" | "1:1"
        );

        // Submit video generation request
        const submitResult = await xaiGenerateVideo({
          prompt: motionPrompt,
          image_url: clip.sourceImageUrl,
          duration: clip.durationSeconds || 5,
          aspect_ratio: xaiAspectRatio,
        });

        logger.info("xAI video generation submitted", {
          requestId: submitResult.request_id,
        });

        // Poll for completion
        const pollResult = await pollVideoUntilComplete(
          submitResult.request_id,
          {
            onProgress: (status) => {
              logger.info("xAI video generation progress", { status });
              if (status.status === "processing") {
                metadata.set("status", {
                  step: "generating",
                  label: "Generating video…",
                  progress: 50,
                } satisfies VideoClipStatus);
              }
            },
          }
        );

        resultVideoUrl = pollResult.video_url;
        logger.info("xAI video generation completed", { resultVideoUrl });
      } else {
        // =========================================================
        // Fal.ai Provider: Kling Video (default)
        // =========================================================
        logger.info("Using Fal.ai provider for video generation", {
          clipId,
          prompt: motionPrompt,
          duration: clip.durationSeconds?.toString() || "5",
          aspectRatio: videoProjectData.videoProject.aspectRatio,
          generate_audio: generateAudio,
        });

        // Prepare Kling input with proper typing
        const klingInput: KlingVideoInput = {
          image_url: falImageUrl,
          tail_image_url: falTailImageUrl, // Use provided tail image or same as source
          prompt: motionPrompt,
          duration: (clip.durationSeconds?.toString() || "5") as "5" | "10",
          aspect_ratio: videoProjectData.videoProject.aspectRatio as
            | "16:9"
            | "9:16"
            | "1:1",
          generate_audio: generateAudio,
          negative_prompt: DEFAULT_NEGATIVE_PROMPT,
        };

        const result = (await fal.subscribe(KLING_VIDEO_PRO, {
          input: klingInput,
          onQueueUpdate: (update) => {
            logger.info("Kling processing update", { update });
            if (update.status === "IN_PROGRESS") {
              metadata.set("status", {
                step: "generating",
                label: "Generating video…",
                progress: 50,
              } satisfies VideoClipStatus);
            }
          },
        })) as unknown as KlingVideoOutput;

        logger.info("Kling result received", { result });

        // Check for result - handle both direct and wrapped response
        const output = (result as { data?: KlingVideoOutput }).data || result;
        if (!output.video?.url) {
          logger.error("No video in response", { result });
          throw new Error("No video returned from Kling API");
        }

        resultVideoUrl = output.video.url;
      }

      // Step 5: Save to Supabase
      metadata.set("status", {
        step: "saving",
        label: "Saving video…",
        progress: 80,
      } satisfies VideoClipStatus);

      logger.info("Downloading result video", { resultVideoUrl });

      const resultVideoResponse = await fetch(resultVideoUrl);
      if (!resultVideoResponse.ok) {
        throw new Error("Failed to download result video");
      }

      const resultVideoBuffer = await resultVideoResponse.arrayBuffer();

      // Use already fetched videoProjectData for workspaceId
      const videoPath = getVideoPath(
        videoProjectData.videoProject.workspaceId,
        clip.videoProjectId,
        `${clipId}.mp4`
      );

      logger.info("Uploading to Supabase", { videoPath });

      const storedVideoUrl = await uploadVideo(
        new Uint8Array(resultVideoBuffer),
        videoPath,
        "video/mp4"
      );

      // Update clip record with result
      await updateVideoClip(clipId, {
        status: "completed",
        clipUrl: storedVideoUrl,
        errorMessage: null,
      });

      // Update project counts
      await updateVideoProjectCounts(clip.videoProjectId);

      metadata.set("status", {
        step: "completed",
        label: "Complete",
        progress: 100,
      } satisfies VideoClipStatus);

      logger.info("Video clip generation completed", {
        clipId,
        clipUrl: storedVideoUrl,
      });

      return {
        success: true,
        clipUrl: storedVideoUrl,
        clipId,
      };
    } catch (error) {
      logger.error("Video clip generation failed", {
        clipId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      metadata.set("status", {
        step: "failed",
        label: "Generation failed",
        progress: 0,
      } satisfies VideoClipStatus);

      // Update status to failed
      await updateVideoClip(clipId, {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Generation failed",
      });

      // Update project counts
      const clip = await getVideoClipById(clipId);
      if (clip) {
        await updateVideoProjectCounts(clip.videoProjectId);
      }

      throw error;
    }
  },
});
