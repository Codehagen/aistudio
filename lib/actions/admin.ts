"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { verifySystemAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { workspace, type WorkspaceStatus, type WorkspacePlan, type Workspace } from "@/lib/db/schema";
import { getAdminWorkspaces } from "@/lib/db/queries";
import type {
  AdminWorkspaceRow,
  AdminWorkspaceFilters,
  AdminWorkspacesMeta,
  SortableWorkspaceColumn,
  SortDirection,
} from "@/lib/types/admin";

// ============================================================================
// Types
// ============================================================================

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// Fetch Workspaces (for pagination)
// ============================================================================

export async function fetchAdminWorkspacesAction(
  cursor: string | null,
  limit: number,
  filters: AdminWorkspaceFilters,
  sort?: [SortableWorkspaceColumn, SortDirection]
): Promise<
  ActionResult<{
    data: AdminWorkspaceRow[];
    meta: AdminWorkspacesMeta;
  }>
> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const result = await getAdminWorkspaces({
      cursor,
      limit,
      filters,
      sort,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[admin:fetchWorkspaces] Error:", error);
    return { success: false, error: "Failed to fetch workspaces" };
  }
}

// ============================================================================
// Update Workspace Status
// ============================================================================

export async function updateWorkspaceStatusAction(
  workspaceId: string,
  status: WorkspaceStatus,
  reason?: string
): Promise<ActionResult<Workspace>> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const updateData: Partial<Workspace> = {
      status,
      updatedAt: new Date(),
    };

    // Set suspension metadata if suspending
    if (status === "suspended") {
      updateData.suspendedAt = new Date();
      updateData.suspendedReason = reason || null;
    } else {
      // Clear suspension metadata if activating
      updateData.suspendedAt = null;
      updateData.suspendedReason = null;
    }

    const [updated] = await db
      .update(workspace)
      .set(updateData)
      .where(eq(workspace.id, workspaceId))
      .returning();

    if (!updated) {
      return { success: false, error: "Workspace not found" };
    }

    revalidatePath("/admin/workspaces");
    return { success: true, data: updated };
  } catch (error) {
    console.error("[admin:updateWorkspaceStatus] Error:", error);
    return { success: false, error: "Failed to update workspace status" };
  }
}

// ============================================================================
// Update Workspace Plan
// ============================================================================

export async function updateWorkspacePlanAction(
  workspaceId: string,
  plan: WorkspacePlan
): Promise<ActionResult<Workspace>> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const [updated] = await db
      .update(workspace)
      .set({
        plan,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, workspaceId))
      .returning();

    if (!updated) {
      return { success: false, error: "Workspace not found" };
    }

    revalidatePath("/admin/workspaces");
    return { success: true, data: updated };
  } catch (error) {
    console.error("[admin:updateWorkspacePlan] Error:", error);
    return { success: false, error: "Failed to update workspace plan" };
  }
}

// ============================================================================
// Delete Workspace
// ============================================================================

export async function deleteWorkspaceAction(
  workspaceId: string
): Promise<ActionResult<void>> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    // Delete workspace (cascades to users, projects, etc. due to FK constraints)
    const [deleted] = await db
      .delete(workspace)
      .where(eq(workspace.id, workspaceId))
      .returning({ id: workspace.id });

    if (!deleted) {
      return { success: false, error: "Workspace not found" };
    }

    revalidatePath("/admin/workspaces");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[admin:deleteWorkspace] Error:", error);
    return { success: false, error: "Failed to delete workspace" };
  }
}

// ============================================================================
// Update Workspace Details
// ============================================================================

export async function updateWorkspaceDetailsAction(
  workspaceId: string,
  data: {
    name?: string;
    organizationNumber?: string;
    contactEmail?: string;
    contactPerson?: string;
  }
): Promise<ActionResult<Workspace>> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const [updated] = await db
      .update(workspace)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, workspaceId))
      .returning();

    if (!updated) {
      return { success: false, error: "Workspace not found" };
    }

    revalidatePath("/admin/workspaces");
    return { success: true, data: updated };
  } catch (error) {
    console.error("[admin:updateWorkspaceDetails] Error:", error);
    return { success: false, error: "Failed to update workspace details" };
  }
}

// ============================================================================
// Impersonation
// ============================================================================

export async function impersonateUserAction(
  userId: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const adminCheck = await verifySystemAdmin();
  if (adminCheck.error) {
    return { success: false, error: adminCheck.error };
  }

  try {
    // Import auth dynamically to avoid circular deps
    const { auth } = await import("@/lib/auth");
    const { headers } = await import("next/headers");

    // Use better-auth's impersonation API
    await auth.api.impersonateUser({
      body: { userId },
      headers: await headers(),
    });

    return { success: true, data: { redirectTo: "/dashboard" } };
  } catch (error) {
    console.error("[admin:impersonateUser] Error:", error);
    return { success: false, error: "Failed to impersonate user" };
  }
}

export async function stopImpersonatingAction(): Promise<
  ActionResult<{ redirectTo: string }>
> {
  try {
    const { auth } = await import("@/lib/auth");
    const { headers } = await import("next/headers");

    await auth.api.stopImpersonating({
      headers: await headers(),
    });

    return { success: true, data: { redirectTo: "/admin/workspaces" } };
  } catch (error) {
    console.error("[admin:stopImpersonating] Error:", error);
    return { success: false, error: "Failed to stop impersonating" };
  }
}
