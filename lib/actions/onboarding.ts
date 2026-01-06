"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user, workspace } from "@/lib/db/schema"

export async function completeOnboarding(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    throw new Error("Unauthorized")
  }

  const name = formData.get("name") as string
  const workspaceName = formData.get("workspaceName") as string
  const organizationNumber = (formData.get("organizationNumber") as string) || null
  const contactEmail = (formData.get("contactEmail") as string) || null
  const contactPerson = (formData.get("contactPerson") as string) || null

  // Validate required fields
  if (!name || !workspaceName) {
    throw new Error("Name and workspace name are required")
  }

  // Get user's workspace
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]?.workspaceId) {
    throw new Error("Workspace not found")
  }

  // Update user name if changed
  if (name !== session.user.name) {
    await db
      .update(user)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))
  }

  // Update workspace with onboarding data
  await db
    .update(workspace)
    .set({
      name: workspaceName,
      organizationNumber,
      contactEmail,
      contactPerson,
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(workspace.id, currentUser[0].workspaceId))

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
