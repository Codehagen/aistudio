import { NextRequest, NextResponse } from "next/server"
import { fal, FLUX_FILL_PRO, type FluxFillOutput } from "@/lib/fal"
import { getImageGenerationById, updateImageGeneration, updateProjectCounts } from "@/lib/db/queries"
import { uploadImage, getImagePath, getExtensionFromContentType } from "@/lib/supabase"
import sharp from "sharp"

export async function POST(request: NextRequest) {
  try {
    const { imageId, maskDataUrl, prompt } = await request.json()

    if (!imageId || !maskDataUrl || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: imageId, maskDataUrl, prompt" },
        { status: 400 }
      )
    }

    // Get image record from database
    const image = await getImageGenerationById(imageId)
    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      )
    }

    // Use the result image if available, otherwise use original
    const sourceImageUrl = image.resultImageUrl || image.originalImageUrl

    try {
      console.log("Inpainting image:", {
        imageId,
        sourceImageUrl,
        prompt,
        maskLength: maskDataUrl.length,
      })

      // Fetch source image and get its dimensions
      const imageResponse = await fetch(sourceImageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch source image: ${imageResponse.status}`)
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      const imageMetadata = await sharp(imageBuffer).metadata()
      const imageWidth = imageMetadata.width!
      const imageHeight = imageMetadata.height!

      console.log("Source image dimensions:", { width: imageWidth, height: imageHeight })

      // Upload source image to Fal.ai storage
      const imageBlob = new Blob([imageBuffer], { type: imageResponse.headers.get("content-type") || "image/jpeg" })
      const falImageUrl = await fal.storage.upload(
        new File([imageBlob], "input.jpg", { type: imageBlob.type })
      )

      console.log("Uploaded image to Fal.ai storage:", falImageUrl)

      // Convert base64 mask data URL to buffer
      const maskBase64 = maskDataUrl.split(",")[1]
      const maskBuffer = Buffer.from(maskBase64, "base64")

      // Resize mask to match source image dimensions
      const resizedMaskBuffer = await sharp(maskBuffer)
        .resize(imageWidth, imageHeight, { fit: "fill" })
        .png()
        .toBuffer()

      console.log("Resized mask to match source image dimensions")

      // Upload resized mask to Fal.ai storage
      const maskBlob = new Blob([resizedMaskBuffer], { type: "image/png" })
      const falMaskUrl = await fal.storage.upload(
        new File([maskBlob], "mask.png", { type: "image/png" })
      )

      console.log("Uploaded mask to Fal.ai storage:", falMaskUrl)

      // Call FLUX Fill Pro API
      const result = await fal.subscribe(FLUX_FILL_PRO, {
        input: {
          image_url: falImageUrl,
          mask_url: falMaskUrl,
          prompt,
          num_inference_steps: 28,
          output_format: "jpeg",
        },
      }) as FluxFillOutput

      console.log("FLUX Fill result:", JSON.stringify(result, null, 2))

      // Check for result - handle both direct and wrapped response
      const output = (result as { data?: FluxFillOutput }).data || result
      if (!output.images?.[0]?.url) {
        console.error("No images in response. Full result:", result)
        throw new Error("No image returned from FLUX Fill")
      }

      const resultImageUrl = output.images[0].url
      const contentType = output.images[0].content_type || "image/jpeg"

      // Download the result image and upload to Supabase
      const resultImageResponse = await fetch(resultImageUrl)
      if (!resultImageResponse.ok) {
        throw new Error("Failed to download result image")
      }

      const resultImageBuffer = await resultImageResponse.arrayBuffer()
      const extension = getExtensionFromContentType(contentType)

      // Upload to Supabase storage with unique name for inpainted version
      const timestamp = Date.now()
      const resultPath = getImagePath(
        image.workspaceId,
        image.projectId,
        `${imageId}_inpaint_${timestamp}.${extension}`,
        "result"
      )
      const storedResultUrl = await uploadImage(
        new Uint8Array(resultImageBuffer),
        resultPath,
        contentType
      )

      // Update image record with new result
      await updateImageGeneration(imageId, {
        status: "completed",
        resultImageUrl: storedResultUrl,
        prompt: prompt, // Update prompt to reflect inpainting instruction
        errorMessage: null,
      })

      // Update project counts
      await updateProjectCounts(image.projectId)

      return NextResponse.json({
        success: true,
        resultUrl: storedResultUrl,
      })
    } catch (processingError) {
      console.error("Inpainting error:", processingError)

      // Log full error details for Fal.ai ApiError
      if (processingError && typeof processingError === 'object' && 'body' in processingError) {
        console.error("Fal.ai error body:", JSON.stringify((processingError as { body: unknown }).body, null, 2))
      }

      return NextResponse.json(
        {
          error: "Inpainting failed",
          details: processingError instanceof Error ? processingError.message : "Unknown error",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
