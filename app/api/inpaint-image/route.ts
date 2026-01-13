import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  createImageGeneration,
  deleteVersionsAfter,
  getImageGenerationById,
  updateProjectCounts,
} from "@/lib/db/queries";
import { fal, NANO_BANANA_PRO_EDIT, QWEN_IMAGE_EDIT_INPAINT } from "@/lib/fal";
import {
  getExtensionFromContentType,
  getImagePath,
  uploadImage,
} from "@/lib/supabase";

type EditMode = "remove" | "add";

export async function POST(request: NextRequest) {
  try {
    const {
      imageId,
      maskDataUrl,
      prompt,
      mode = "remove",
      replaceNewerVersions = false,
    } = (await request.json()) as {
      imageId: string;
      maskDataUrl?: string;
      prompt: string;
      mode?: EditMode;
      replaceNewerVersions?: boolean;
    };

    if (!(imageId && prompt)) {
      return NextResponse.json(
        { error: "Missing required fields: imageId, prompt" },
        { status: 400 }
      );
    }

    // Mask is required for remove mode
    if (mode === "remove" && !maskDataUrl) {
      return NextResponse.json(
        { error: "Mask is required for remove mode" },
        { status: 400 }
      );
    }

    // Get image record from database
    const image = await getImageGenerationById(imageId);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Use the result image if available, otherwise use original
    const sourceImageUrl = image.resultImageUrl || image.originalImageUrl;

    try {
      console.log("Processing image:", {
        imageId,
        sourceImageUrl,
        prompt,
        mode,
        maskLength: maskDataUrl?.length ?? 0,
      });

      // Fetch source image
      const imageResponse = await fetch(sourceImageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch source image: ${imageResponse.status}`
        );
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageMetadata = await sharp(imageBuffer).metadata();
      const imageWidth = imageMetadata.width!;
      const imageHeight = imageMetadata.height!;

      console.log("Source image dimensions:", {
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

      console.log("Uploaded image to Fal.ai storage:", falImageUrl);

      let resultImageUrl: string;
      let contentType: string;

      if (mode === "remove") {
        // REMOVE MODE: Use Qwen Image Edit Inpaint (inpainting)
        // Convert base64 mask data URL to buffer
        if (!maskDataUrl) {
          return NextResponse.json(
            { error: "Mask is required for remove mode" },
            { status: 400 }
          );
        }
        const maskBase64 = maskDataUrl.split(",")[1];
        if (!maskBase64) {
          return NextResponse.json(
            { error: "Invalid mask data URL format" },
            { status: 400 }
          );
        }
        const maskBuffer = Buffer.from(maskBase64, "base64");

        // Resize mask to match source image dimensions
        const resizedMaskBuffer = await sharp(maskBuffer)
          .resize(imageWidth, imageHeight, { fit: "fill" })
          .png()
          .toBuffer();

        console.log("Resized mask to match source image dimensions");

        // Upload resized mask to Fal.ai storage
        const maskBlob = new Blob([new Uint8Array(resizedMaskBuffer)], {
          type: "image/png",
        });
        const falMaskUrl = await fal.storage.upload(
          new File([maskBlob], "mask.png", { type: "image/png" })
        );

        console.log("Uploaded mask to Fal.ai storage:", falMaskUrl);

        // Call Qwen Image Edit Inpaint API
        const result = await fal.subscribe(QWEN_IMAGE_EDIT_INPAINT, {
          input: {
            prompt,
            image_url: falImageUrl,
            mask_url: falMaskUrl,
            output_format: "jpeg",
          },
        });

        console.log("Qwen Inpaint result:", JSON.stringify(result, null, 2));

        // Extract output from Result type (has data property)
        const output = result.data;
        if (!output.images?.[0]?.url) {
          console.error("No images in response. Full result:", result);
          throw new Error("No image returned from Qwen Inpaint");
        }

        resultImageUrl = output.images[0].url;
        contentType = output.images[0].content_type || "image/jpeg";
      } else {
        // ADD MODE: Use Nano Banana Pro (image-to-image)
        console.log("Using Nano Banana Pro for add mode");

        const result = await fal.subscribe(NANO_BANANA_PRO_EDIT, {
          input: {
            prompt,
            image_urls: [falImageUrl],
            num_images: 1,
            output_format: "jpeg",
          },
        });

        console.log("Nano Banana result:", JSON.stringify(result, null, 2));

        // Extract output from Result type (has data property)
        const output = result.data;
        if (!output.images?.[0]?.url) {
          console.error("No images in response. Full result:", result);
          throw new Error("No image returned from Nano Banana");
        }

        resultImageUrl = output.images[0].url;
        contentType = output.images[0].content_type || "image/jpeg";
      }

      // Download the result image and upload to Supabase
      const resultImageResponse = await fetch(resultImageUrl);
      if (!resultImageResponse.ok) {
        throw new Error("Failed to download result image");
      }

      const resultImageBuffer = await resultImageResponse.arrayBuffer();
      const extension = getExtensionFromContentType(contentType);

      // Upload to Supabase storage with unique name for new version
      const newImageId = crypto.randomUUID();
      const resultPath = getImagePath(
        image.workspaceId,
        image.projectId,
        `${newImageId}.${extension}`,
        "result"
      );
      const storedResultUrl = await uploadImage(
        new Uint8Array(resultImageBuffer),
        resultPath,
        contentType
      );

      // Calculate version info
      // The root image is either the parentId (if editing a version) or the current image (if editing original)
      const rootImageId = image.parentId || image.id;
      const currentVersion = image.version || 1;

      // If replacing newer versions, delete them first
      if (replaceNewerVersions) {
        const deletedCount = await deleteVersionsAfter(
          rootImageId,
          currentVersion
        );
        if (deletedCount > 0) {
          console.log(
            `Deleted ${deletedCount} newer version(s) before creating new edit`
          );
        }
      }

      const newVersion = currentVersion + 1;

      // Create new image record as a new version (don't overwrite)
      const newImage = await createImageGeneration({
        workspaceId: image.workspaceId,
        userId: image.userId,
        projectId: image.projectId,
        originalImageUrl: image.originalImageUrl, // Keep the original source
        resultImageUrl: storedResultUrl,
        prompt,
        version: newVersion,
        parentId: rootImageId, // Link to the root/original image
        status: "completed",
        errorMessage: null,
        metadata: {
          editedFrom: image.id,
          editedAt: new Date().toISOString(),
          editMode: mode,
          model:
            mode === "remove" ? "qwen-image-edit-inpaint" : "nano-banana-pro",
        },
      });

      // Update project counts
      await updateProjectCounts(image.projectId);

      return NextResponse.json({
        success: true,
        resultUrl: storedResultUrl,
        newImageId: newImage.id,
        version: newVersion,
      });
    } catch (processingError) {
      console.error("Inpainting error:", processingError);

      // Log full error details for Fal.ai ApiError
      if (
        processingError &&
        typeof processingError === "object" &&
        "body" in processingError
      ) {
        console.error(
          "Fal.ai error body:",
          JSON.stringify((processingError as { body: unknown }).body, null, 2)
        );
      }

      return NextResponse.json(
        {
          error: "Inpainting failed",
          details:
            processingError instanceof Error
              ? processingError.message
              : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
