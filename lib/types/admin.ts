import type { WorkspaceStatus, WorkspacePlan } from "@/lib/db/schema";

// ============================================================================
// Admin Workspace Types
// ============================================================================

export interface AdminWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  status: WorkspaceStatus;
  plan: WorkspacePlan;
  memberCount: number;
  imagesGenerated: number;
  videosGenerated: number;
  videosCompleted: number;
  totalSpend: number;
  totalVideoSpend: number;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerImage: string | null;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AdminWorkspaceFilters {
  search?: string;
  status?: WorkspaceStatus | null;
  plan?: WorkspacePlan | null;
}

export type SortableWorkspaceColumn =
  | "name"
  | "memberCount"
  | "imagesGenerated"
  | "totalSpend"
  | "createdAt"
  | "lastActivityAt";

export type SortDirection = "asc" | "desc";

export interface AdminWorkspacesMeta {
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

// ============================================================================
// Admin User Types (for future Phase 2)
// ============================================================================

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "owner" | "admin" | "member";
  isSystemAdmin: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  imagesGenerated: number;
  lastActiveAt: Date | null;
  createdAt: Date;
}

export interface AdminUserFilters {
  search?: string;
  role?: "owner" | "admin" | "member" | null;
  status?: "active" | "pending" | "inactive" | null;
  workspaceId?: string | null;
}

export type SortableUserColumn =
  | "name"
  | "email"
  | "role"
  | "imagesGenerated"
  | "lastActiveAt"
  | "createdAt";

// ============================================================================
// Constants
// ============================================================================

export const ALL_WORKSPACE_STATUSES: WorkspaceStatus[] = [
  "active",
  "suspended",
  "trial",
];

export const ALL_WORKSPACE_PLANS: WorkspacePlan[] = [
  "free",
  "pro",
  "enterprise",
];

export const COST_PER_IMAGE = 0.039; // USD per image
