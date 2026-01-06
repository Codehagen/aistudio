"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, or, inArray } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  user,
  imageGeneration,
  type ImageGeneration,
} from "@/lib/db/schema"
import {
  createImageGeneration,
  updateImageGeneration,
  getImageGenerationById,
  getProjectById,
  updateProjectCounts,
  updateProject,
} from "@/lib/db/queries"
import {
  deleteImage,
  getImagePath,
  getExtensionFromContentType,
  createSignedUploadUrl,
  getPublicUrl,
} from "@/lib/supabase"
import { getTemplateById, generatePrompt } from "@/lib/style-templates"

export type ActionResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
}

// Generate signed upload URLs for client-side direct upload
export async function createSignedUploadUrls(
  projectId: string,
  files: { name: string; type: string }[]
): Promise<ActionResult<{ imageId: string; signedUrl: string; token: string; path: string }[]>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  const workspaceId = currentUser[0].workspaceId

  // Check project belongs to user's workspace
  const projectData = await getProjectById(projectId)
  if (!projectData || projectData.project.workspaceId !== workspaceId) {
    return { success: false, error: "Project not found" }
  }

  // Limit to 10 images per project
  const existingCount = projectData.images.length
  const maxNew = Math.min(files.length, 10 - existingCount)
  if (maxNew <= 0) {
    return { success: false, error: "Project already has maximum 10 images" }
  }

  try {
    const signedUrls = await Promise.all(
      files.slice(0, maxNew).map(async (file) => {
        const imageId = crypto.randomUUID()
        const extension = getExtensionFromContentType(file.type)
        const path = getImagePath(workspaceId, projectId, `${imageId}.${extension}`, "original")

        const { signedUrl, token } = await createSignedUploadUrl(path)

        return {
          imageId,
          signedUrl,
          token,
          path,
        }
      })
    )

    return { success: true, data: signedUrls }
  } catch (error) {
    console.error("Failed to create signed upload URLs:", error)
    return { success: false, error: "Failed to create upload URLs" }
  }
}

// Record images in database after client-side upload completes
export async function recordUploadedImages(
  projectId: string,
  images: { imageId: string; path: string; fileName: string; fileSize: number; contentType: string; roomType?: string | null }[]
): Promise<ActionResult<ImageGeneration[]>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  const workspaceId = currentUser[0].workspaceId

  // Check project belongs to user's workspace
  const projectData = await getProjectById(projectId)
  if (!projectData || projectData.project.workspaceId !== workspaceId) {
    return { success: false, error: "Project not found" }
  }

  // Get the style template for the prompt
  const template = getTemplateById(projectData.project.styleTemplateId)
  if (!template) {
    return { success: false, error: "Style template not found" }
  }

  try {
    const uploadedImages: ImageGeneration[] = []

    for (const image of images) {
      const publicUrl = getPublicUrl(image.path)

      // Use per-image room type if provided, otherwise fall back to project room type
      const roomType = image.roomType || projectData.project.roomType
      const prompt = generatePrompt(template, roomType)

      // Create database record
      const imageRecord = await createImageGeneration({
        workspaceId,
        userId: session.user.id,
        projectId,
        originalImageUrl: publicUrl,
        resultImageUrl: null,
        prompt,
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
      })

      uploadedImages.push(imageRecord)
    }

    // Update first image as thumbnail if project doesn't have one
    if (!projectData.project.thumbnailUrl && uploadedImages.length > 0) {
      await updateProject(projectId, {
        thumbnailUrl: uploadedImages[0].originalImageUrl,
      })
    }

    // Update project counts
    await updateProjectCounts(projectId)

    // Trigger image processing for each uploaded image (fire-and-forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    for (const image of uploadedImages) {
      // Update status to processing
      await updateImageGeneration(image.id, { status: "processing" })

      // Fire-and-forget: trigger processing API
      fetch(`${baseUrl}/api/process-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: image.id }),
      }).catch((err) => {
        console.error(`Failed to trigger processing for image ${image.id}:`, err)
      })
    }

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/${projectId}`)

    return { success: true, data: uploadedImages }
  } catch (error) {
    console.error("Failed to record uploaded images:", error)
    return { success: false, error: "Failed to record images" }
  }
}

// Delete a single image from a project
export async function deleteProjectImage(
  imageId: string
): Promise<ActionResult<void>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  // Get image record
  const image = await getImageGenerationById(imageId)
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" }
  }

  const projectId = image.projectId

  try {
    // Delete from Supabase storage
    // Extract path from URL
    const originalPath = extractPathFromUrl(image.originalImageUrl)
    if (originalPath) {
      await deleteImage(originalPath).catch(() => {
        // Ignore errors if file doesn't exist
      })
    }

    if (image.resultImageUrl) {
      const resultPath = extractPathFromUrl(image.resultImageUrl)
      if (resultPath) {
        await deleteImage(resultPath).catch(() => {
          // Ignore errors if file doesn't exist
        })
      }
    }

    // Delete from database
    await db.delete(imageGeneration).where(eq(imageGeneration.id, imageId))

    // Update project counts
    await updateProjectCounts(projectId)

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/${projectId}`)

    return { success: true, data: undefined }
  } catch (error) {
    console.error("Failed to delete image:", error)
    return { success: false, error: "Failed to delete image" }
  }
}

// Delete multiple selected images and their versions
export async function deleteSelectedImages(
  imageIds: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  if (imageIds.length === 0) {
    return { success: false, error: "No images selected" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  const workspaceId = currentUser[0].workspaceId

  try {
    // Get all selected images
    const selectedImages = await db
      .select()
      .from(imageGeneration)
      .where(inArray(imageGeneration.id, imageIds))

    // Verify all images belong to user's workspace
    for (const img of selectedImages) {
      if (img.workspaceId !== workspaceId) {
        return { success: false, error: "Unauthorized access to image" }
      }
    }

    // Find all root image IDs (either the image itself or its parentId)
    const rootIds = new Set<string>()
    for (const img of selectedImages) {
      rootIds.add(img.parentId || img.id)
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
      )

    // Track project IDs for updating counts later
    const projectIds = new Set<string>()

    // Delete files from Supabase storage
    for (const img of allVersionImages) {
      projectIds.add(img.projectId)

      // Delete original image
      const originalPath = extractPathFromUrl(img.originalImageUrl)
      if (originalPath) {
        await deleteImage(originalPath).catch(() => {
          // Ignore errors if file doesn't exist
        })
      }

      // Delete result image
      if (img.resultImageUrl) {
        const resultPath = extractPathFromUrl(img.resultImageUrl)
        if (resultPath) {
          await deleteImage(resultPath).catch(() => {
            // Ignore errors if file doesn't exist
          })
        }
      }
    }

    // Delete all version chain images from database
    const imageIdsToDelete = allVersionImages.map((img) => img.id)
    await db
      .delete(imageGeneration)
      .where(inArray(imageGeneration.id, imageIdsToDelete))

    // Update project counts for all affected projects
    for (const projectId of projectIds) {
      await updateProjectCounts(projectId)
      revalidatePath(`/dashboard/${projectId}`)
    }

    revalidatePath("/dashboard")

    return { success: true, data: { deletedCount: allVersionImages.length } }
  } catch (error) {
    console.error("Failed to delete selected images:", error)
    return { success: false, error: "Failed to delete images" }
  }
}

// Retry failed image processing
export async function retryImageProcessing(
  imageId: string
): Promise<ActionResult<ImageGeneration>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  // Get image record
  const image = await getImageGenerationById(imageId)
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" }
  }

  if (image.status !== "failed") {
    return { success: false, error: "Image is not in failed state" }
  }

  try {
    // Reset status to pending for retry
    const updated = await updateImageGeneration(imageId, {
      status: "pending",
      errorMessage: null,
    })

    if (!updated) {
      return { success: false, error: "Failed to update image" }
    }

    // Update project counts
    await updateProjectCounts(image.projectId)

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/${image.projectId}`)

    return { success: true, data: updated }
  } catch (error) {
    console.error("Failed to retry image:", error)
    return { success: false, error: "Failed to retry image" }
  }
}

// Update image status (used by processing pipeline)
export async function updateImageStatus(
  imageId: string,
  status: "pending" | "processing" | "completed" | "failed",
  resultUrl?: string,
  errorMessage?: string
): Promise<ActionResult<ImageGeneration>> {
  const image = await getImageGenerationById(imageId)
  if (!image) {
    return { success: false, error: "Image not found" }
  }

  try {
    const updated = await updateImageGeneration(imageId, {
      status,
      resultImageUrl: resultUrl || undefined,
      errorMessage: errorMessage || undefined,
    })

    if (!updated) {
      return { success: false, error: "Failed to update image" }
    }

    // Update project counts
    await updateProjectCounts(image.projectId)

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/${image.projectId}`)

    return { success: true, data: updated }
  } catch (error) {
    console.error("Failed to update image status:", error)
    return { success: false, error: "Failed to update image status" }
  }
}

// Regenerate an image with the same or different style
export async function regenerateImage(
  imageId: string,
  newTemplateId?: string
): Promise<ActionResult<ImageGeneration>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  // Get image record
  const image = await getImageGenerationById(imageId)
  if (!image || image.workspaceId !== currentUser[0].workspaceId) {
    return { success: false, error: "Image not found" }
  }

  // Get the template (use new one if provided, otherwise use existing)
  const templateId = newTemplateId || (image.metadata as { templateId?: string })?.templateId
  const template = templateId ? getTemplateById(templateId) : null

  if (!template) {
    return { success: false, error: "Style template not found" }
  }

  // Get project to get room type for prompt generation
  const projectData = await getProjectById(image.projectId)
  const roomType = projectData?.project.roomType || (image.metadata as { roomType?: string })?.roomType || null

  // Generate prompt with room type context
  const prompt = generatePrompt(template, roomType)

  try {
    // Reset status to pending and update prompt if using new template
    const updated = await updateImageGeneration(imageId, {
      status: "pending",
      prompt,
      errorMessage: null,
      resultImageUrl: null,
      metadata: {
        ...(image.metadata as object),
        templateId: template.id,
        templateName: template.name,
        roomType,
      },
    })

    if (!updated) {
      return { success: false, error: "Failed to update image" }
    }

    // Trigger processing
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    await updateImageGeneration(imageId, { status: "processing" })

    fetch(`${baseUrl}/api/process-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    }).catch((err) => {
      console.error(`Failed to trigger processing for image ${imageId}:`, err)
    })

    // Update project counts
    await updateProjectCounts(image.projectId)

    revalidatePath("/dashboard")
    revalidatePath(`/dashboard/${image.projectId}`)

    return { success: true, data: updated }
  } catch (error) {
    console.error("Failed to regenerate image:", error)
    return { success: false, error: "Failed to regenerate image" }
  }
}

// Helper function to extract storage path from Supabase URL
function extractPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/)
    return pathMatch ? pathMatch[1] : null
  } catch {
    return null
  }
}
