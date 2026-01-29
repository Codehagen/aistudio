"use server";

import { tasks } from "@trigger.dev/sdk/v3";
import { eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createImageGeneration,
  deleteVersionsAfter,
  getImageGenerationById,
  getProjectById,
  updateImageGeneration,
  updateProject,
  updateProjectCounts,
} from "@/lib/db/queries";
import { type ImageGeneration, imageGeneration, user } from "@/lib/db/schema";
import { generatePrompt, getTemplateById } from "@/lib/style-templates";
import {
  createSignedUploadUrl,
  deleteImage,
  getExtensionFromContentType,
  getImagePath,
  getPublicUrl,
} from "@/lib/supabase";
import type { EditMode, inpaintImageTask } from "@/trigger/inpaint-image";
import { processImageTask } from "@/trigger/process-image";

// Top-level regex for extracting storage path from Supabase URLs
const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/[^/]+\/(.+)/;

export type ActionResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

// Generate signed upload URLs for client-side direct upload
export async function createSignedUploadUrls(
  projectId: string,
  files: { name: string; type: string }[]
): Promise<
  ActionResult<
    { imageId: string; signedUrl: string; token: string; path: string }[]
  >
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  const workspaceId = currentUser[0].workspaceId;

  // Check project belongs to user's workspace
  const projectData = await getProjectById(projectId);
  if (!projectData || projectData.project.workspaceId !== workspaceId) {
    return { success: false, error: "Project not found" };
  }

  // Limit to 10 images per project
  const existingCount = projectData.images.length;
  const maxNew = Math.min(files.length, 10 - existingCount);
  if (maxNew <= 0) {
    return { success: false, error: "Project already has maximum 10 images" };
  }

  try {
    const signedUrls = await Promise.all(
      files.slice(0, maxNew).map(async (file) => {
        const imageId = crypto.randomUUID();
        const extension = getExtensionFromContentType(file.type);
        const path = getImagePath(
          workspaceId,
          projectId,
          `${imageId}.${extension}`,
          "original"
        );

        const { signedUrl, token } = await createSignedUploadUrl(path);

        return {
          imageId,
          signedUrl,
          token,
          path,
        };
      })
    );

    return { success: true, data: signedUrls };
  } catch (error) {
    console.error("Failed to create signed upload URLs:", error);
    return { success: false, error: "Failed to create upload URLs" };
  }
}

// Extended type for images with run IDs
export type ImageWithRunId = ImageGeneration & { runId?: string };

// Record images in database after client-side upload completes
// NOTE: Processing is now gated by payment status
export async function recordUploadedImages(
  projectId: string,
  images: {
    imageId: string;
    path: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    roomType?: string | null;
  }[]
): Promise<ActionResult<ImageWithRunId[]>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  const workspaceId = currentUser[0].workspaceId;

  // Check project belongs to user's workspace
  const projectData = await getProjectById(projectId);
  if (!projectData || projectData.project.workspaceId !== workspaceId) {
    return { success: false, error: "Project not found" };
  }

  // Get the style template for the prompt
  const template = getTemplateById(projectData.project.styleTemplateId);
  if (!template) {
    return { success: false, error: "Style template not found" };
  }

  try {
    const uploadedImages: ImageWithRunId[] = [];

    for (const image of images) {
      const publicUrl = getPublicUrl(image.path);

      // Use per-image room type if provided, otherwise fall back to project room type
      const roomType = image.roomType || projectData.project.roomType;
      const prompt = generatePrompt(template, roomType);

      // Create database record with status "pending" (will be processed after payment)
      const imageRecord = await createImageGeneration({
        workspaceId,
        userId: session.user.id,
        projectId,
        originalImageUrl: publicUrl,
        resultImageUrl: null,
        prompt,
        version: 1,
        parentId: null,
        status: "pending",
        errorMessage: null,
        metadata: {
          templateId: template.id,
          templateName: template.name,
          roomType,
          originalFileName: image.fileName,
          originalFileSize: image.fileSize,
          contentType: image.contentType,
        },
      });

      uploadedImages.push(imageRecord);
    }

    // Update first image as thumbnail if project doesn't have one
    if (!projectData.project.thumbnailUrl && uploadedImages.length > 0) {
      await updateProject(projectId, {
        thumbnailUrl: uploadedImages[0].originalImageUrl,
      });
    }

    // Update project counts
    await updateProjectCounts(projectId);

    // NOTE: Processing is NO LONGER automatically triggered here.
    // Images stay in "pending" status until:
    // 1. User assigns room types to all images on project detail page
    // 2. User clicks "Start Processing" which handles payment and triggers processing
    // This allows per-image room type assignment before processing begins.

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${projectId}`);

    return { success: true, data: uploadedImages };
  } catch (error) {
    console.error("Failed to record uploaded images:", error);
    return { success: false, error: "Failed to record images" };
  }
}

/**
 * Trigger processing for all pending images in a project
 * Called by Stripe webhook after successful payment
 */
export async function triggerProjectProcessing(
  projectId: string
): Promise<ActionResult<{ processedCount: number }>> {
  try {
    const projectData = await getProjectById(projectId);
    if (!projectData) {
      return { success: false, error: "Project not found" };
    }

    // Get all pending images for this project
    const pendingImages = projectData.images.filter(
      (img) => img.status === "pending"
    );

    if (pendingImages.length === 0) {
      return { success: true, data: { processedCount: 0 } };
    }

    // Trigger processing for each pending image
    for (const image of pendingImages) {
      const handle = await processImageTask.trigger({ imageId: image.id });

      await updateImageGeneration(image.id, {
        status: "processing",
        metadata: {
          ...(image.metadata as object),
          runId: handle.id,
        },
      });
    }

    // Update project status
    await updateProject(projectId, { status: "processing" });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${projectId}`);

    return { success: true, data: { processedCount: pendingImages.length } };
  } catch (error) {
    console.error("Failed to trigger project processing:", error);
    return { success: false, error: "Failed to trigger processing" };
  }
}

/**
 * Update room type for a single image
 */
export async function updateImageRoomType(
  imageId: string,
  roomType: string
): Promise<ActionResult<ImageGeneration>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  // Get image record
  const image = await getImageGenerationById(imageId);
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" };
  }

  // Get template for regenerating prompt
  const templateId = (image.metadata as { templateId?: string })?.templateId;
  const template = templateId ? getTemplateById(templateId) : null;

  if (!template) {
    return { success: false, error: "Style template not found" };
  }

  // Generate new prompt with updated room type
  const prompt = generatePrompt(template, roomType);

  try {
    const updated = await updateImageGeneration(imageId, {
      prompt,
      metadata: {
        ...(image.metadata as object),
        roomType,
      },
    });

    if (!updated) {
      return { success: false, error: "Failed to update image" };
    }

    revalidatePath(`/dashboard/${image.projectId}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Failed to update image room type:", error);
    return { success: false, error: "Failed to update room type" };
  }
}

/**
 * Bulk update room types for multiple images
 */
export async function bulkUpdateImageRoomTypes(
  imageIds: string[],
  roomType: string
): Promise<ActionResult<{ updatedCount: number }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  if (imageIds.length === 0) {
    return { success: false, error: "No images selected" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  const workspaceId = currentUser[0].workspaceId;

  try {
    // Get all selected images
    const selectedImages = await db
      .select()
      .from(imageGeneration)
      .where(inArray(imageGeneration.id, imageIds));

    // Verify all images belong to user's workspace
    for (const img of selectedImages) {
      if (img.workspaceId !== workspaceId) {
        return { success: false, error: "Unauthorized access to image" };
      }
    }

    // Track project IDs for revalidation
    const projectIds = new Set<string>();

    // Update each image
    for (const image of selectedImages) {
      projectIds.add(image.projectId);

      const templateId = (image.metadata as { templateId?: string })
        ?.templateId;
      const template = templateId ? getTemplateById(templateId) : null;

      if (template) {
        const prompt = generatePrompt(template, roomType);
        await updateImageGeneration(image.id, {
          prompt,
          metadata: {
            ...(image.metadata as object),
            roomType,
          },
        });
      }
    }

    // Revalidate all affected project pages
    for (const projectId of projectIds) {
      revalidatePath(`/dashboard/${projectId}`);
    }

    return { success: true, data: { updatedCount: selectedImages.length } };
  } catch (error) {
    console.error("Failed to bulk update room types:", error);
    return { success: false, error: "Failed to update room types" };
  }
}

/**
 * Start processing for a project after room types are assigned
 * Validates all images have room types, handles payment, and triggers processing
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Payment flow requires multiple branching paths
export async function startProjectProcessing(projectId: string): Promise<
  ActionResult<{
    processedCount: number;
    requiresPayment?: boolean;
    checkoutUrl?: string;
  }>
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  const workspaceId = currentUser[0].workspaceId;

  // Get project and verify ownership
  const projectData = await getProjectById(projectId);
  if (!projectData || projectData.project.workspaceId !== workspaceId) {
    return { success: false, error: "Project not found" };
  }

  // Get pending images
  const pendingImages = projectData.images.filter(
    (img) => img.status === "pending"
  );

  if (pendingImages.length === 0) {
    return { success: true, data: { processedCount: 0 } };
  }

  // Validate all pending images have room types
  const imagesWithoutRoomType = pendingImages.filter((img) => {
    const roomType = (img.metadata as { roomType?: string })?.roomType;
    return !roomType;
  });

  if (imagesWithoutRoomType.length > 0) {
    return {
      success: false,
      error: `${imagesWithoutRoomType.length} image(s) need room types assigned before processing`,
    };
  }

  try {
    // Import payment functions
    const {
      canUseInvoiceBilling,
      createInvoicePayment,
      getProjectPaymentStatus,
      createStripeCheckoutSession,
      chargeWithSavedPaymentMethod,
      getWorkspacePaymentMethods,
    } = await import("./payments");

    // Check invoice eligibility
    const invoiceEligibility = await canUseInvoiceBilling(workspaceId);

    if (invoiceEligibility.eligible) {
      // Invoice customer - create invoice and process
      const paymentResult = await createInvoicePayment(projectId);

      if (!paymentResult.success) {
        return { success: false, error: "Failed to create invoice" };
      }

      // Trigger processing
      for (const image of pendingImages) {
        const handle = await processImageTask.trigger({ imageId: image.id });

        await updateImageGeneration(image.id, {
          status: "processing",
          metadata: {
            ...(image.metadata as object),
            runId: handle.id,
          },
        });
      }

      await updateProject(projectId, { status: "processing" });

      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/${projectId}`);

      return { success: true, data: { processedCount: pendingImages.length } };
    }

    // Non-invoice workspace - check payment status
    const paymentStatus = await getProjectPaymentStatus(projectId);

    if (paymentStatus.isPaid) {
      // Already paid - trigger processing
      for (const image of pendingImages) {
        const handle = await processImageTask.trigger({ imageId: image.id });

        await updateImageGeneration(image.id, {
          status: "processing",
          metadata: {
            ...(image.metadata as object),
            runId: handle.id,
          },
        });
      }

      await updateProject(projectId, { status: "processing" });

      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/${projectId}`);

      return { success: true, data: { processedCount: pendingImages.length } };
    }

    // Not paid - try saved payment method first
    const paymentMethodsResult = await getWorkspacePaymentMethods(workspaceId);

    if (
      paymentMethodsResult.success &&
      paymentMethodsResult.data.paymentMethods.length > 0
    ) {
      const defaultCard = paymentMethodsResult.data.paymentMethods[0];
      const chargeResult = await chargeWithSavedPaymentMethod(
        projectId,
        defaultCard.id
      );

      if (chargeResult.success) {
        // Payment succeeded - trigger processing
        for (const image of pendingImages) {
          const handle = await processImageTask.trigger({ imageId: image.id });

          await updateImageGeneration(image.id, {
            status: "processing",
            metadata: {
              ...(image.metadata as object),
              runId: handle.id,
            },
          });
        }

        await updateProject(projectId, { status: "processing" });

        revalidatePath("/dashboard");
        revalidatePath(`/dashboard/${projectId}`);

        return {
          success: true,
          data: { processedCount: pendingImages.length },
        };
      }
    }

    // No saved card or charge failed - create checkout session
    const checkoutResult = await createStripeCheckoutSession(projectId);

    if (checkoutResult.success) {
      return {
        success: true,
        data: {
          processedCount: 0,
          requiresPayment: true,
          checkoutUrl: checkoutResult.data.url,
        },
      };
    }

    return { success: false, error: "Failed to create payment session" };
  } catch (error) {
    console.error("Failed to start project processing:", error);
    return { success: false, error: "Failed to start processing" };
  }
}

// Delete a single image from a project
export async function deleteProjectImage(
  imageId: string
): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  // Get image record
  const image = await getImageGenerationById(imageId);
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" };
  }

  const projectId = image.projectId;

  try {
    // Delete from Supabase storage
    // Extract path from URL
    const originalPath = extractPathFromUrl(image.originalImageUrl);
    if (originalPath) {
      await deleteImage(originalPath).catch(() => {
        // Ignore errors if file doesn't exist
      });
    }

    if (image.resultImageUrl) {
      const resultPath = extractPathFromUrl(image.resultImageUrl);
      if (resultPath) {
        await deleteImage(resultPath).catch(() => {
          // Ignore errors if file doesn't exist
        });
      }
    }

    // Delete from database
    await db.delete(imageGeneration).where(eq(imageGeneration.id, imageId));

    // Update project counts
    await updateProjectCounts(projectId);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${projectId}`);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Failed to delete image:", error);
    return { success: false, error: "Failed to delete image" };
  }
}

// Delete multiple selected images and their versions
export async function deleteSelectedImages(
  imageIds: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  if (imageIds.length === 0) {
    return { success: false, error: "No images selected" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  const workspaceId = currentUser[0].workspaceId;

  try {
    // Get all selected images
    const selectedImages = await db
      .select()
      .from(imageGeneration)
      .where(inArray(imageGeneration.id, imageIds));

    // Verify all images belong to user's workspace
    for (const img of selectedImages) {
      if (img.workspaceId !== workspaceId) {
        return { success: false, error: "Unauthorized access to image" };
      }
    }

    // Find all root image IDs (either the image itself or its parentId)
    const rootIds = new Set<string>();
    for (const img of selectedImages) {
      rootIds.add(img.parentId || img.id);
    }

    // Get all images that are part of any version chain (root + children)
    const allVersionImages = await db
      .select()
      .from(imageGeneration)
      .where(
        or(
          inArray(imageGeneration.id, Array.from(rootIds)),
          inArray(imageGeneration.parentId, Array.from(rootIds))
        )
      );

    // Track project IDs for updating counts later
    const projectIds = new Set<string>();

    // Delete files from Supabase storage
    for (const img of allVersionImages) {
      projectIds.add(img.projectId);

      // Delete original image
      const originalPath = extractPathFromUrl(img.originalImageUrl);
      if (originalPath) {
        await deleteImage(originalPath).catch(() => {
          // Ignore errors if file doesn't exist
        });
      }

      // Delete result image
      if (img.resultImageUrl) {
        const resultPath = extractPathFromUrl(img.resultImageUrl);
        if (resultPath) {
          await deleteImage(resultPath).catch(() => {
            // Ignore errors if file doesn't exist
          });
        }
      }
    }

    // Delete all version chain images from database
    const imageIdsToDelete = allVersionImages.map((img) => img.id);
    await db
      .delete(imageGeneration)
      .where(inArray(imageGeneration.id, imageIdsToDelete));

    // Update project counts for all affected projects
    for (const projectId of projectIds) {
      await updateProjectCounts(projectId);
      revalidatePath(`/dashboard/${projectId}`);
    }

    revalidatePath("/dashboard");

    return { success: true, data: { deletedCount: allVersionImages.length } };
  } catch (error) {
    console.error("Failed to delete selected images:", error);
    return { success: false, error: "Failed to delete images" };
  }
}

// Retry failed image processing
export async function retryImageProcessing(
  imageId: string
): Promise<ActionResult<ImageWithRunId>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  // Get image record
  const image = await getImageGenerationById(imageId);
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" };
  }

  if (image.status !== "failed") {
    return { success: false, error: "Image is not in failed state" };
  }

  try {
    // Trigger the background task first to get runId
    const handle = await processImageTask.trigger({ imageId });

    // Reset status to processing for retry and store runId in metadata
    const updated = await updateImageGeneration(imageId, {
      status: "processing",
      errorMessage: null,
      metadata: {
        ...(image.metadata as object),
        runId: handle.id,
      },
    });

    if (!updated) {
      return { success: false, error: "Failed to update image" };
    }

    // Update project counts
    await updateProjectCounts(image.projectId);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${image.projectId}`);

    return { success: true, data: { ...updated, runId: handle.id } };
  } catch (error) {
    console.error("Failed to retry image:", error);
    return { success: false, error: "Failed to retry image" };
  }
}

// Update image status (used by processing pipeline)
export async function updateImageStatus(
  imageId: string,
  status: "pending" | "processing" | "completed" | "failed",
  resultUrl?: string,
  errorMessage?: string
): Promise<ActionResult<ImageGeneration>> {
  const image = await getImageGenerationById(imageId);
  if (!image) {
    return { success: false, error: "Image not found" };
  }

  try {
    const updated = await updateImageGeneration(imageId, {
      status,
      resultImageUrl: resultUrl || undefined,
      errorMessage: errorMessage || undefined,
    });

    if (!updated) {
      return { success: false, error: "Failed to update image" };
    }

    // Update project counts
    await updateProjectCounts(image.projectId);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${image.projectId}`);

    return { success: true, data: updated };
  } catch (error) {
    console.error("Failed to update image status:", error);
    return { success: false, error: "Failed to update image status" };
  }
}

// Regenerate an image with the same or different style
export async function regenerateImage(
  imageId: string,
  newTemplateId?: string
): Promise<ActionResult<ImageWithRunId>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  // Get image record
  const image = await getImageGenerationById(imageId);
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" };
  }

  // Get the template (use new one if provided, otherwise use existing)
  const templateId =
    newTemplateId || (image.metadata as { templateId?: string })?.templateId;
  const template = templateId ? getTemplateById(templateId) : null;

  if (!template) {
    return { success: false, error: "Style template not found" };
  }

  // Get project to get room type for prompt generation
  const projectData = await getProjectById(image.projectId);
  const roomType =
    projectData?.project.roomType ||
    (image.metadata as { roomType?: string })?.roomType ||
    null;

  // Generate prompt with room type context
  const prompt = generatePrompt(template, roomType);

  try {
    // Trigger the background task first to get runId
    const handle = await processImageTask.trigger({ imageId });

    // Reset status to processing and update prompt if using new template
    const updated = await updateImageGeneration(imageId, {
      status: "processing",
      prompt,
      errorMessage: null,
      resultImageUrl: null,
      metadata: {
        ...(image.metadata as object),
        templateId: template.id,
        templateName: template.name,
        roomType,
        runId: handle.id,
      },
    });

    if (!updated) {
      return { success: false, error: "Failed to update image" };
    }

    // Update project counts
    await updateProjectCounts(image.projectId);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${image.projectId}`);

    return { success: true, data: { ...updated, runId: handle.id } };
  } catch (error) {
    console.error("Failed to regenerate image:", error);
    return { success: false, error: "Failed to regenerate image" };
  }
}

// Trigger inpainting task for image editing
export async function triggerInpaintTask(
  imageId: string,
  prompt: string,
  mode: EditMode,
  maskDataUrl?: string,
  replaceNewerVersions?: boolean,
  provider: "fal" | "xai" = "fal"
): Promise<ActionResult<{ runId: string; newImageId: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" };
  }

  // Get image record
  const image = await getImageGenerationById(imageId);
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" };
  }

  // Mask is required for Fal.ai provider, optional for xAI (prompt-only)
  if (provider === "fal" && !maskDataUrl) {
    return {
      success: false,
      error: "Mask is required for Fal.ai provider",
    };
  }

  try {
    // Calculate version info
    const rootImageId = image.parentId || image.id;
    const currentVersion = image.version || 1;

    // Handle replaceNewerVersions - delete newer versions before creating placeholder
    if (replaceNewerVersions) {
      await deleteVersionsAfter(rootImageId, currentVersion);
    }

    // Create placeholder record with status "processing" for real-time tracking
    // Use the source image (result or original) so the processing card shows the image being edited
    const sourceImageUrl = image.resultImageUrl || image.originalImageUrl;
    const newImage = await createImageGeneration({
      workspaceId: image.workspaceId,
      userId: session.user.id,
      projectId: image.projectId,
      originalImageUrl: sourceImageUrl,
      resultImageUrl: null,
      prompt,
      version: currentVersion + 1,
      parentId: rootImageId,
      status: "processing",
      errorMessage: null,
      metadata: {
        editedFrom: imageId,
        editMode: mode,
        provider,
      },
    });

    // Trigger the background task with the pre-created record ID
    console.log("[triggerInpaintTask] Triggering inpaint task", {
      imageId,
      newImageId: newImage.id,
      mode,
      hasMask: !!maskDataUrl,
      promptLength: prompt.length,
      provider,
    });

    let handle;
    try {
      // Use tasks.trigger for consistency with video generation
      // This is the recommended approach in Trigger.dev v4
      handle = await tasks.trigger<typeof inpaintImageTask>("inpaint-image", {
        imageId,
        newImageId: newImage.id,
        prompt,
        mode,
        maskDataUrl,
        provider,
      });

      if (!handle?.id) {
        console.error(
          "[triggerInpaintTask] Trigger failed: No run ID returned"
        );
        throw new Error("Failed to trigger inpaint task: No run ID returned");
      }

      console.log("[triggerInpaintTask] Trigger successful", {
        runId: handle.id,
      });
    } catch (triggerError) {
      console.error("[triggerInpaintTask] Trigger error:", triggerError);
      // Log full error details
      if (triggerError instanceof Error) {
        console.error(
          "[triggerInpaintTask] Error message:",
          triggerError.message
        );
        console.error("[triggerInpaintTask] Error stack:", triggerError.stack);
      }
      // Update the record to failed status
      await updateImageGeneration(newImage.id, {
        status: "failed",
        errorMessage:
          triggerError instanceof Error
            ? triggerError.message
            : "Failed to trigger task",
      });
      throw triggerError;
    }

    // Update metadata with runId for real-time Trigger.dev tracking
    await updateImageGeneration(newImage.id, {
      metadata: {
        ...(newImage.metadata as object),
        runId: handle.id,
      },
    });

    // Update project counts
    await updateProjectCounts(image.projectId);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${image.projectId}`);

    return {
      success: true,
      data: { runId: handle.id, newImageId: newImage.id },
    };
  } catch (error) {
    console.error("Failed to trigger inpaint task:", error);
    return { success: false, error: "Failed to start edit" };
  }
}

// Helper function to extract storage path from Supabase URL
function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(SUPABASE_PATH_REGEX);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}
