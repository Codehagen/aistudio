"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, workspace } from "@/lib/db/schema"

export type WorkspaceActionResult = {
  success: boolean
  error?: string
}

export async function updateWorkspaceSettings(
  formData: FormData
): Promise<WorkspaceActionResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return { success: false, error: "Unauthorized" }
  }

  // Get current user to find workspace and check permissions
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    return { success: false, error: "Workspace not found" }
  }

  // Check if user is owner or admin
  if (currentUser[0].role !== "owner" && currentUser[0].role !== "admin") {
    return { success: false, error: "Insufficient permissions" }
  }

  const name = formData.get("name") as string
  const organizationNumber = (formData.get("organizationNumber") as string) || null
  const contactEmail = (formData.get("contactEmail") as string) || null
  const contactPerson = (formData.get("contactPerson") as string) || null

  // Validate required fields
  if (!name) {
    return { success: false, error: "Workspace name is required" }
  }

  // Update workspace
  await db
    .update(workspace)
    .set({
      name,
      organizationNumber,
      contactEmail,
      contactPerson,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, currentUser[0].workspaceId))

  revalidatePath("/dashboard/settings")
  return { success: true }
}
