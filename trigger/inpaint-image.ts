import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import sharp from "sharp";
import {
  getImageGenerationById,
  updateImageGeneration,
  updateProjectCounts,
} from "@/lib/db/queries";
import {
  fal,
  NANO_BANANA_PRO_EDIT,
  type NanoBananaProOutput,
  QWEN_IMAGE_EDIT_INPAINT,
  type QwenInpaintOutput,
} from "@/lib/fal";
import {
  getExtensionFromContentType,
  getImagePath,
  uploadImage,
} from "@/lib/supabase";

export type EditMode = "remove" | "add";

export interface InpaintImagePayload {
  imageId: string;
  newImageId: string; // Pre-created record ID for real-time tracking
  maskDataUrl?: string;
  prompt: string;
  mode: EditMode;
}

export interface InpaintImageStatus {
  step:
    | "fetching"
    | "preparing"
    | "processing"
    | "saving"
    | "completed"
    | "failed";
  label: string;
  progress?: number;
}

export const inpaintImageTask = task({
  id: "inpaint-image",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10_000,
    factor: 2,
  },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Inpainting has multiple modes and error handling paths
  run: async (payload: InpaintImagePayload) => {
    const {
      imageId,
      newImageId,
      maskDataUrl,
      prompt,
      mode = "remove",
    } = payload;

    try {
      // Step 1: Fetch image record
      metadata.set("status", {
        step: "fetching",
        label: "Loading image…",
        progress: 10,
      } satisfies InpaintImageStatus);

      logger.info("Fetching image record for inpainting", { imageId, mode });

      const image = await getImageGenerationById(imageId);
      if (!image) {
        throw new Error(`Image not found: ${imageId}`);
      }

      // Use the result image if available, otherwise use original
      const sourceImageUrl = image.resultImageUrl || image.originalImageUrl;

      // Step 2: Prepare images
      metadata.set("status", {
        step: "preparing",
        label: mode === "remove" ? "Processing mask…" : "Preparing edit…",
        progress: 25,
      } satisfies InpaintImageStatus);

      logger.info("Fetching source image", { sourceImageUrl });

      const imageResponse = await fetch(sourceImageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch source image: ${imageResponse.status}`
        );
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageMetadata = await sharp(imageBuffer).metadata();
      const imageWidth = imageMetadata.width;
      const imageHeight = imageMetadata.height;

      if (!(imageWidth && imageHeight)) {
        throw new Error("Could not determine image dimensions");
      }

      logger.info("Source image dimensions", {
        width: imageWidth,
        height: imageHeight,
      });

      // Upload source image to Fal.ai storage
      const imageBlob = new Blob([imageBuffer], {
        type: imageResponse.headers.get("content-type") || "image/jpeg",
      });
      const falImageUrl = await fal.storage.upload(
        new File([imageBlob], "input.jpg", { type: imageBlob.type })
      );

      logger.info("Uploaded image to Fal.ai storage", { falImageUrl });

      let resultImageUrl: string;
      let contentType: string;

      // Step 3: Process with AI
      metadata.set("status", {
        step: "processing",
        label:
          mode === "remove" ? "Removing selected area…" : "Generating edit…",
        progress: 50,
      } satisfies InpaintImageStatus);

      if (mode === "remove") {
        // REMOVE MODE: Use Qwen Image Edit Inpaint (inpainting)
        if (!maskDataUrl) {
          throw new Error("Mask is required for remove mode");
        }

        // Convert base64 mask data URL to buffer
        const maskBase64 = maskDataUrl.split(",")[1];
        const maskBuffer = Buffer.from(maskBase64, "base64");

        // Resize mask to match source image dimensions
        const resizedMaskBuffer = await sharp(maskBuffer)
          .resize(imageWidth, imageHeight, { fit: "fill" })
          .png()
          .toBuffer();

        logger.info("Resized mask to match source image dimensions");

        // Upload resized mask to Fal.ai storage
        const maskBlob = new Blob([new Uint8Array(resizedMaskBuffer)], {
          type: "image/png",
        });
        const falMaskUrl = await fal.storage.upload(
          new File([maskBlob], "mask.png", { type: "image/png" })
        );

        logger.info("Uploaded mask to Fal.ai storage", { falMaskUrl });

        // Call Qwen Image Edit Inpaint API
        const result = (await fal.subscribe(QWEN_IMAGE_EDIT_INPAINT, {
          input: {
            prompt,
            image_url: falImageUrl,
            mask_url: falMaskUrl,
            output_format: "jpeg",
          },
        })) as unknown as QwenInpaintOutput;

        logger.info("Qwen Inpaint result received");

        // Check for result - handle both direct and wrapped response
        const output = (result as { data?: QwenInpaintOutput }).data || result;
        if (!output.images?.[0]?.url) {
          logger.error("No images in response", { result });
          throw new Error("No image returned from Qwen Inpaint");
        }

        resultImageUrl = output.images[0].url;
        contentType = output.images[0].content_type || "image/jpeg";
      } else {
        // ADD MODE: Use Nano Banana Pro (image-to-image)
        logger.info("Using Nano Banana Pro for add mode");

        const result = (await fal.subscribe(NANO_BANANA_PRO_EDIT, {
          input: {
            prompt,
            image_urls: [falImageUrl],
            num_images: 1,
            output_format: "jpeg",
          },
        })) as unknown as NanoBananaProOutput;

        logger.info("Nano Banana result received");

        // Check for result - handle both direct and wrapped response
        const output =
          (result as { data?: NanoBananaProOutput }).data || result;
        if (!output.images?.[0]?.url) {
          logger.error("No images in response", { result });
          throw new Error("No image returned from Nano Banana");
        }

        resultImageUrl = output.images[0].url;
        contentType = output.images[0].content_type || "image/jpeg";
      }

      // Step 4: Save result
      metadata.set("status", {
        step: "saving",
        label: "Saving new version…",
        progress: 80,
      } satisfies InpaintImageStatus);

      logger.info("Downloading result image", { resultImageUrl });

      const resultImageResponse = await fetch(resultImageUrl);
      if (!resultImageResponse.ok) {
        throw new Error("Failed to download result image");
      }

      const resultImageBuffer = await resultImageResponse.arrayBuffer();
      const extension = getExtensionFromContentType(contentType);

      // Upload to Supabase storage with unique name for the result
      const resultFileId = crypto.randomUUID();
      const resultPath = getImagePath(
        image.workspaceId,
        image.projectId,
        `${resultFileId}.${extension}`,
        "result"
      );

      logger.info("Uploading to Supabase", { resultPath });

      const storedResultUrl = await uploadImage(
        new Uint8Array(resultImageBuffer),
        resultPath,
        contentType
      );

      // Update the pre-created image record with the result
      await updateImageGeneration(newImageId, {
        resultImageUrl: storedResultUrl,
        status: "completed",
        errorMessage: null,
        metadata: {
          editedFrom: imageId,
          editedAt: new Date().toISOString(),
          editMode: mode,
          model:
            mode === "remove" ? "qwen-image-edit-inpaint" : "nano-banana-pro",
        },
      });

      // Update project counts
      await updateProjectCounts(image.projectId);

      metadata.set("status", {
        step: "completed",
        label: "Complete",
        progress: 100,
      } satisfies InpaintImageStatus);

      logger.info("Inpainting completed", {
        imageId,
        newImageId,
      });

      return {
        success: true,
        resultUrl: storedResultUrl,
        newImageId,
      };
    } catch (error) {
      logger.error("Inpainting failed", {
        imageId,
        newImageId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Update the pre-created record to failed status
      try {
        await updateImageGeneration(newImageId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Edit failed",
        });
      } catch (updateError) {
        logger.error("Failed to update image record to failed status", {
          newImageId,
          updateError,
        });
      }

      metadata.set("status", {
        step: "failed",
        label: "Edit failed",
        progress: 0,
      } satisfies InpaintImageStatus);

      throw error;
    }
  },
});
