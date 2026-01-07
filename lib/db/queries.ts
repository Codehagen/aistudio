import { eq, desc, count, and, sum, gt, max, or, sql } from "drizzle-orm";
import { db } from "./index";
import {
  user,
  workspace,
  project,
  imageGeneration,
  videoProject,
  videoClip,
  musicTrack,
  type User,
  type Workspace,
  type Project,
  type ImageGeneration,
  type ProjectStatus,
  type VideoProject,
  type VideoClip,
  type MusicTrack,
  type VideoProjectStatus,
  type WorkspaceStatus,
  type WorkspacePlan,
  NewVideoClip,
} from "./schema";
import type {
  AdminWorkspaceRow,
  AdminWorkspaceFilters,
  AdminWorkspacesMeta,
  SortableWorkspaceColumn,
  SortDirection,
} from "@/lib/types/admin";
import { COST_PER_IMAGE } from "@/lib/types/admin";

// ============================================================================
// User Queries
// ============================================================================

export async function getUserById(userId: string): Promise<User | null> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return result[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return result[0] || null;
}

export async function updateUser(
  userId: string,
  data: Partial<Omit<User, "id" | "createdAt">>,
): Promise<User | null> {
  const result = await db
    .update(user)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();
  return result[0] || null;
}

// ============================================================================
// Workspace Queries
// ============================================================================

export async function getWorkspaceById(
  workspaceId: string,
): Promise<Workspace | null> {
  const result = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);
  return result[0] || null;
}

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | null> {
  const result = await db
    .select()
    .from(workspace)
    .where(eq(workspace.slug, slug))
    .limit(1);
  return result[0] || null;
}

export async function updateWorkspace(
  workspaceId: string,
  data: Partial<Omit<Workspace, "id" | "createdAt">>,
): Promise<Workspace | null> {
  const result = await db
    .update(workspace)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspace.id, workspaceId))
    .returning();
  return result[0] || null;
}

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<User[]> {
  return db
    .select()
    .from(user)
    .where(eq(user.workspaceId, workspaceId))
    .orderBy(desc(user.createdAt));
}

// ============================================================================
// Image Generation Queries
// ============================================================================

export async function getImageGenerations(
  workspaceId: string,
  options?: { limit?: number; offset?: number },
): Promise<ImageGeneration[]> {
  const query = db
    .select()
    .from(imageGeneration)
    .where(eq(imageGeneration.workspaceId, workspaceId))
    .orderBy(desc(imageGeneration.createdAt));

  if (options?.limit) {
    query.limit(options.limit);
  }

  if (options?.offset) {
    query.offset(options.offset);
  }

  return query;
}

export async function getImageGenerationById(
  id: string,
): Promise<ImageGeneration | null> {
  const result = await db
    .select()
    .from(imageGeneration)
    .where(eq(imageGeneration.id, id))
    .limit(1);
  return result[0] || null;
}

export async function getImageGenerationStats(workspaceId: string): Promise<{
  total: number;
  completed: number;
  processing: number;
  failed: number;
}> {
  const [totalResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(eq(imageGeneration.workspaceId, workspaceId));

  const [completedResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(
      and(
        eq(imageGeneration.workspaceId, workspaceId),
        eq(imageGeneration.status, "completed"),
      ),
    );

  const [processingResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(
      and(
        eq(imageGeneration.workspaceId, workspaceId),
        eq(imageGeneration.status, "processing"),
      ),
    );

  const [failedResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(
      and(
        eq(imageGeneration.workspaceId, workspaceId),
        eq(imageGeneration.status, "failed"),
      ),
    );

  return {
    total: totalResult?.count || 0,
    completed: completedResult?.count || 0,
    processing: processingResult?.count || 0,
    failed: failedResult?.count || 0,
  };
}

export async function createImageGeneration(
  data: Omit<ImageGeneration, "id" | "createdAt" | "updatedAt">,
): Promise<ImageGeneration> {
  const id = crypto.randomUUID();
  const [result] = await db
    .insert(imageGeneration)
    .values({
      ...data,
      id,
    })
    .returning();
  return result;
}

export async function updateImageGeneration(
  id: string,
  data: Partial<Omit<ImageGeneration, "id" | "createdAt">>,
): Promise<ImageGeneration | null> {
  const result = await db
    .update(imageGeneration)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(imageGeneration.id, id))
    .returning();
  return result[0] || null;
}

// ============================================================================
// User with Workspace (joined query)
// ============================================================================

export async function getUserWithWorkspace(userId: string): Promise<{
  user: User;
  workspace: Workspace;
} | null> {
  const userResult = await getUserById(userId);
  if (!userResult || !userResult.workspaceId) {
    return null;
  }

  const workspaceResult = await getWorkspaceById(userResult.workspaceId);
  if (!workspaceResult) {
    return null;
  }

  return {
    user: userResult,
    workspace: workspaceResult,
  };
}

// ============================================================================
// Project Queries
// ============================================================================

export async function getProjects(
  workspaceId: string,
  options?: { limit?: number; offset?: number; status?: ProjectStatus },
): Promise<Project[]> {
  let query = db
    .select()
    .from(project)
    .where(
      options?.status
        ? and(
            eq(project.workspaceId, workspaceId),
            eq(project.status, options.status),
          )
        : eq(project.workspaceId, workspaceId),
    )
    .orderBy(desc(project.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return query;
}

export async function getProjectById(id: string): Promise<{
  project: Project;
  images: ImageGeneration[];
} | null> {
  const projectResult = await db
    .select()
    .from(project)
    .where(eq(project.id, id))
    .limit(1);

  if (!projectResult[0]) {
    return null;
  }

  const images = await db
    .select()
    .from(imageGeneration)
    .where(eq(imageGeneration.projectId, id))
    .orderBy(desc(imageGeneration.createdAt));

  return {
    project: projectResult[0],
    images,
  };
}

export async function getProjectStats(workspaceId: string): Promise<{
  totalProjects: number;
  completedProjects: number;
  processingProjects: number;
  totalImages: number;
  totalCost: number;
}> {
  const [totalResult] = await db
    .select({ count: count() })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  const [completedResult] = await db
    .select({ count: count() })
    .from(project)
    .where(
      and(
        eq(project.workspaceId, workspaceId),
        eq(project.status, "completed"),
      ),
    );

  const [processingResult] = await db
    .select({ count: count() })
    .from(project)
    .where(
      and(
        eq(project.workspaceId, workspaceId),
        eq(project.status, "processing"),
      ),
    );

  const [imagesResult] = await db
    .select({ total: sum(project.imageCount) })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  const [completedImagesResult] = await db
    .select({ total: sum(project.completedCount) })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  // Calculate cost: $0.039 per completed image
  const completedImages = Number(completedImagesResult?.total) || 0;
  const totalCost = Math.round(completedImages * 0.039 * 100) / 100;

  return {
    totalProjects: totalResult?.count || 0,
    completedProjects: completedResult?.count || 0,
    processingProjects: processingResult?.count || 0,
    totalImages: Number(imagesResult?.total) || 0,
    totalCost,
  };
}

export async function createProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">,
): Promise<Project> {
  const id = crypto.randomUUID();
  const [result] = await db
    .insert(project)
    .values({
      ...data,
      id,
    })
    .returning();
  return result;
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, "id" | "createdAt">>,
): Promise<Project | null> {
  const result = await db
    .update(project)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(project.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(project).where(eq(project.id, id));
}

export async function updateProjectCounts(projectId: string): Promise<void> {
  // Count total images for the project
  const [totalResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(eq(imageGeneration.projectId, projectId));

  // Count completed images
  const [completedResult] = await db
    .select({ count: count() })
    .from(imageGeneration)
    .where(
      and(
        eq(imageGeneration.projectId, projectId),
        eq(imageGeneration.status, "completed"),
      ),
    );

  const imageCount = totalResult?.count || 0;
  const completedCount = completedResult?.count || 0;

  // Determine project status based on image statuses
  let status: ProjectStatus = "pending";

  if (completedCount === imageCount && imageCount > 0) {
    status = "completed";
  } else if (completedCount > 0) {
    status = "processing";
  } else {
    // Check if any images are processing
    const [processingResult] = await db
      .select({ count: count() })
      .from(imageGeneration)
      .where(
        and(
          eq(imageGeneration.projectId, projectId),
          eq(imageGeneration.status, "processing"),
        ),
      );

    if ((processingResult?.count || 0) > 0) {
      status = "processing";
    }

    // Check if any images failed
    const [failedResult] = await db
      .select({ count: count() })
      .from(imageGeneration)
      .where(
        and(
          eq(imageGeneration.projectId, projectId),
          eq(imageGeneration.status, "failed"),
        ),
      );

    if ((failedResult?.count || 0) > 0 && completedCount === 0) {
      status = "failed";
    }
  }

  // Update project
  await db
    .update(project)
    .set({
      imageCount,
      completedCount,
      status,
      updatedAt: new Date(),
    })
    .where(eq(project.id, projectId));
}

// Get images for a project
export async function getProjectImages(
  projectId: string,
): Promise<ImageGeneration[]> {
  return db
    .select()
    .from(imageGeneration)
    .where(eq(imageGeneration.projectId, projectId))
    .orderBy(desc(imageGeneration.createdAt));
}

// Get all versions of an image (including the original)
export async function getImageVersions(
  imageId: string,
): Promise<ImageGeneration[]> {
  // First get the image to find its root
  const image = await getImageGenerationById(imageId);
  if (!image) return [];

  // The root is either the parentId or the image itself
  const rootId = image.parentId || image.id;

  // Get all versions: the root + all images with parentId = rootId
  const versions = await db.select().from(imageGeneration).where(
    // Either the root image itself OR any image with this parentId
    eq(imageGeneration.id, rootId),
  );

  const children = await db
    .select()
    .from(imageGeneration)
    .where(eq(imageGeneration.parentId, rootId));

  // Combine and sort by version
  const allVersions = [...versions, ...children].sort(
    (a, b) => (a.version || 1) - (b.version || 1),
  );

  return allVersions;
}

// Get the latest version of an image
export async function getLatestImageVersion(
  imageId: string,
): Promise<ImageGeneration | null> {
  const versions = await getImageVersions(imageId);
  if (versions.length === 0) return null;
  return versions[versions.length - 1];
}

// Get the highest version number for a root image
export async function getLatestVersionNumber(
  rootImageId: string,
): Promise<number> {
  // Get max version from: the root image itself OR any image with this parentId
  const [rootResult] = await db
    .select({ version: imageGeneration.version })
    .from(imageGeneration)
    .where(eq(imageGeneration.id, rootImageId))
    .limit(1);

  const [childResult] = await db
    .select({ maxVersion: max(imageGeneration.version) })
    .from(imageGeneration)
    .where(eq(imageGeneration.parentId, rootImageId));

  const rootVersion = rootResult?.version || 1;
  const childMaxVersion = childResult?.maxVersion || 0;

  return Math.max(rootVersion, childMaxVersion);
}

// Delete all versions after a specific version number
export async function deleteVersionsAfter(
  rootImageId: string,
  afterVersion: number,
): Promise<number> {
  // Delete images where:
  // - parentId = rootImageId AND version > afterVersion
  // - OR id = rootImageId AND version > afterVersion (edge case for root)
  const result = await db
    .delete(imageGeneration)
    .where(
      and(
        or(
          eq(imageGeneration.parentId, rootImageId),
          eq(imageGeneration.id, rootImageId),
        ),
        gt(imageGeneration.version, afterVersion),
      ),
    )
    .returning();

  return result.length;
}

// Get project images grouped by root (for version display)
export async function getProjectImagesGrouped(
  projectId: string,
): Promise<Map<string, ImageGeneration[]>> {
  const images = await getProjectImages(projectId);

  // Group by root image ID
  const grouped = new Map<string, ImageGeneration[]>();

  for (const img of images) {
    const rootId = img.parentId || img.id;
    if (!grouped.has(rootId)) {
      grouped.set(rootId, []);
    }
    grouped.get(rootId)!.push(img);
  }

  // Sort each group by version
  for (const [, versions] of grouped) {
    versions.sort((a, b) => (a.version || 1) - (b.version || 1));
  }

  return grouped;
}

// Get only the latest version of each image in a project (for bulk download)
export async function getLatestVersionImages(
  projectId: string,
): Promise<ImageGeneration[]> {
  const grouped = await getProjectImagesGrouped(projectId);
  const latestVersions: ImageGeneration[] = [];

  for (const [, versions] of grouped) {
    // Get the last (highest version) from each group
    const latest = versions[versions.length - 1];
    if (latest && latest.status === "completed") {
      latestVersions.push(latest);
    }
  }

  // Sort by creation date (oldest first for consistent ordering)
  return latestVersions.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

// ============================================================================
// Video Project Queries
// ============================================================================

export async function getVideoProjects(
  workspaceId: string,
  options?: { limit?: number; offset?: number; status?: VideoProjectStatus },
): Promise<VideoProject[]> {
  let query = db
    .select()
    .from(videoProject)
    .where(
      options?.status
        ? and(
            eq(videoProject.workspaceId, workspaceId),
            eq(videoProject.status, options.status),
          )
        : eq(videoProject.workspaceId, workspaceId),
    )
    .orderBy(desc(videoProject.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }

  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return query;
}

export async function getVideoProjectById(id: string): Promise<{
  videoProject: VideoProject;
  clips: VideoClip[];
  musicTrack: MusicTrack | null;
} | null> {
  if (process.env.DEBUG_VIDEO === "1") {
    console.log(`[db:queries] getVideoProjectById starting for ID: ${id}`);
  }

  try {
    const result = await db
      .select()
      .from(videoProject)
      .where(eq(videoProject.id, id))
      .limit(1);

    if (!result[0]) {
      if (process.env.DEBUG_VIDEO === "1") {
        console.warn(
          `[db:queries] getVideoProjectById: No project found with ID: ${id}`,
        );
      }
      return null;
    }

    if (process.env.DEBUG_VIDEO === "1") {
      console.log(
        `[db:queries] getVideoProjectById: Found project "${result[0].name}"`,
      );
    }

    const clips = await db
      .select()
      .from(videoClip)
      .where(eq(videoClip.videoProjectId, id))
      .orderBy(videoClip.sequenceOrder);

    if (process.env.DEBUG_VIDEO === "1") {
      console.log(
        `[db:queries] getVideoProjectById: Found ${clips.length} clips for project ${id}`,
      );
    }

    let music: MusicTrack | null = null;
    if (result[0].musicTrackId) {
      const musicResult = await db
        .select()
        .from(musicTrack)
        .where(eq(musicTrack.id, result[0].musicTrackId))
        .limit(1);
      music = musicResult[0] || null;
      if (process.env.DEBUG_VIDEO === "1") {
        console.log(
          `[db:queries] getVideoProjectById: Music track ${result[0].musicTrackId} found: ${!!music}`,
        );
      }
    }

    return {
      videoProject: result[0],
      clips,
      musicTrack: music,
    };
  } catch (error) {
    console.error(
      `[db:queries] getVideoProjectById error for ID ${id}:`,
      error,
    );
    throw error;
  }
}

export async function createVideoProject(
  data: Omit<VideoProject, "id" | "createdAt" | "updatedAt">,
): Promise<VideoProject> {
  const id = crypto.randomUUID();
  const [result] = await db
    .insert(videoProject)
    .values({
      ...data,
      id,
    })
    .returning();
  return result;
}

export async function updateVideoProject(
  id: string,
  data: Partial<Omit<VideoProject, "id" | "createdAt">>,
): Promise<VideoProject | null> {
  if (process.env.DEBUG_VIDEO === "1") {
    console.log(`[db:queries] updateVideoProject starting for ID: ${id}`, {
      status: data.status,
    });
  }

  try {
    const result = await db
      .update(videoProject)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(videoProject.id, id))
      .returning();

    if (!result[0]) {
      if (process.env.DEBUG_VIDEO === "1") {
        console.warn(
          `[db:queries] updateVideoProject: No project found to update with ID: ${id}`,
        );
      }
      return null;
    }

    if (process.env.DEBUG_VIDEO === "1") {
      console.log(`[db:queries] updateVideoProject successful for ID: ${id}`);
    }
    return result[0];
  } catch (error) {
    console.error(`[db:queries] updateVideoProject error for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteVideoProject(id: string): Promise<void> {
  await db.delete(videoProject).where(eq(videoProject.id, id));
}

export async function updateVideoProjectCounts(
  videoProjectId: string,
): Promise<void> {
  // Count total clips
  const [totalResult] = await db
    .select({ count: count() })
    .from(videoClip)
    .where(eq(videoClip.videoProjectId, videoProjectId));

  // Count completed clips
  const [completedResult] = await db
    .select({ count: count() })
    .from(videoClip)
    .where(
      and(
        eq(videoClip.videoProjectId, videoProjectId),
        eq(videoClip.status, "completed"),
      ),
    );

  const clipCount = totalResult?.count || 0;
  const completedClipCount = completedResult?.count || 0;

  // Update project
  await db
    .update(videoProject)
    .set({
      clipCount,
      completedClipCount,
      updatedAt: new Date(),
    })
    .where(eq(videoProject.id, videoProjectId));
}

// ============================================================================
// Video Clip Queries
// ============================================================================

export async function getVideoClipById(id: string): Promise<VideoClip | null> {
  const result = await db
    .select()
    .from(videoClip)
    .where(eq(videoClip.id, id))
    .limit(1);
  return result[0] || null;
}

export async function getVideoClips(
  videoProjectId: string,
): Promise<VideoClip[]> {
  return db
    .select()
    .from(videoClip)
    .where(eq(videoClip.videoProjectId, videoProjectId))
    .orderBy(videoClip.sequenceOrder);
}

export async function createVideoClip(
  data: Omit<VideoClip, "id" | "createdAt" | "updatedAt">,
): Promise<VideoClip> {
  const id = crypto.randomUUID();
  const [result] = await db
    .insert(videoClip)
    .values({
      ...data,
      id,
    })
    .returning();
  return result;
}

export async function createVideoClips(
  clips: Array<Omit<NewVideoClip, "id" | "createdAt" | "updatedAt">>,
): Promise<VideoClip[]> {
  const clipsWithIds = clips.map((clip) => ({
    ...clip,
    id: crypto.randomUUID(),
  }));
  const result = await db
    .insert(videoClip)
    .values(clipsWithIds as NewVideoClip[])
    .returning();
  return result;
}

export async function updateVideoClip(
  id: string,
  data: Partial<Omit<VideoClip, "id" | "createdAt">>,
): Promise<VideoClip | null> {
  const result = await db
    .update(videoClip)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(videoClip.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteVideoClip(id: string): Promise<void> {
  await db.delete(videoClip).where(eq(videoClip.id, id));
}

export async function updateClipSequenceOrders(
  clips: Array<{ id: string; sequenceOrder: number }>,
): Promise<void> {
  for (const clip of clips) {
    await db
      .update(videoClip)
      .set({ sequenceOrder: clip.sequenceOrder, updatedAt: new Date() })
      .where(eq(videoClip.id, clip.id));
  }
}

// ============================================================================
// Music Track Queries
// ============================================================================

export async function getMusicTracks(options?: {
  category?: string;
  activeOnly?: boolean;
}): Promise<MusicTrack[]> {
  let query = db.select().from(musicTrack);

  if (options?.category) {
    query = query.where(
      eq(musicTrack.category, options.category),
    ) as typeof query;
  }

  if (options?.activeOnly !== false) {
    query = query.where(eq(musicTrack.isActive, true)) as typeof query;
  }

  return query.orderBy(musicTrack.name);
}

export async function getMusicTrackById(
  id: string,
): Promise<MusicTrack | null> {
  const result = await db
    .select()
    .from(musicTrack)
    .where(eq(musicTrack.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createMusicTrack(
  data: Omit<MusicTrack, "id" | "createdAt">,
): Promise<MusicTrack> {
  const id = crypto.randomUUID();
  const [result] = await db
    .insert(musicTrack)
    .values({
      ...data,
      id,
    })
    .returning();
  return result;
}

// ============================================================================
// Video Stats
// ============================================================================

export async function getVideoProjectStats(workspaceId: string): Promise<{
  totalVideos: number;
  completedVideos: number;
  processingVideos: number;
  totalCostCents: number;
}> {
  const [totalResult] = await db
    .select({ count: count() })
    .from(videoProject)
    .where(eq(videoProject.workspaceId, workspaceId));

  const [completedResult] = await db
    .select({ count: count() })
    .from(videoProject)
    .where(
      and(
        eq(videoProject.workspaceId, workspaceId),
        eq(videoProject.status, "completed"),
      ),
    );

  const [processingResult] = await db
    .select({ count: count() })
    .from(videoProject)
    .where(
      and(
        eq(videoProject.workspaceId, workspaceId),
        or(
          eq(videoProject.status, "generating"),
          eq(videoProject.status, "compiling"),
        ),
      ),
    );

  const [costResult] = await db
    .select({ total: sum(videoProject.actualCost) })
    .from(videoProject)
    .where(eq(videoProject.workspaceId, workspaceId));

  return {
    totalVideos: totalResult?.count || 0,
    completedVideos: completedResult?.count || 0,
    processingVideos: processingResult?.count || 0,
    totalCostCents: Number(costResult?.total) || 0,
  };
}

// ============================================================================
// Admin Queries (System Admin Only)
// ============================================================================

interface AdminWorkspaceQueryRow {
  [key: string]: unknown;
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  created_at: string | Date;
  updated_at: string | Date;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_image: string | null;
  member_count: string;
  images_generated: string;
  videos_generated: string;
  videos_completed: string;
  video_cost_cents: string;
  last_activity_at: string | Date;
}

export async function getAdminWorkspaces(options: {
  cursor?: string | null;
  limit?: number;
  filters?: AdminWorkspaceFilters;
  sort?: [SortableWorkspaceColumn, SortDirection];
}): Promise<{
  data: AdminWorkspaceRow[];
  meta: AdminWorkspacesMeta;
}> {
  const { cursor, limit = 20, filters, sort } = options;

  // Get total count (for status/plan filters only, not cursor)
  const countConditions: ReturnType<typeof eq>[] = [];
  if (filters?.status) {
    countConditions.push(eq(workspace.status, filters.status));
  }
  if (filters?.plan) {
    countConditions.push(eq(workspace.plan, filters.plan));
  }

  const [totalResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(countConditions.length > 0 ? and(...countConditions) : undefined);

  // Build the main query with raw SQL for complex aggregations
  // We need to join user (for owner), count members, sum images, and sum videos
  const workspacesResult = await db.execute<AdminWorkspaceQueryRow>(sql`
    SELECT
      w.id,
      w.name,
      w.slug,
      w.status,
      w.plan,
      w.created_at,
      w.updated_at,
      owner.id as owner_id,
      owner.name as owner_name,
      owner.email as owner_email,
      owner.image as owner_image,
      COALESCE(member_counts.member_count, 0)::text as member_count,
      COALESCE(image_counts.images_generated, 0)::text as images_generated,
      COALESCE(video_counts.videos_generated, 0)::text as videos_generated,
      COALESCE(video_counts.videos_completed, 0)::text as videos_completed,
      COALESCE(video_counts.video_cost_cents, 0)::text as video_cost_cents,
      GREATEST(
        w.updated_at,
        COALESCE(project_activity.last_project_update, w.updated_at),
        COALESCE(video_activity.last_video_update, w.updated_at)
      ) as last_activity_at
    FROM workspace w
    LEFT JOIN "user" owner ON owner.workspace_id = w.id AND owner.role = 'owner'
    LEFT JOIN (
      SELECT workspace_id, COUNT(*)::int as member_count
      FROM "user"
      GROUP BY workspace_id
    ) member_counts ON member_counts.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, SUM(completed_count)::int as images_generated
      FROM project
      GROUP BY workspace_id
    ) image_counts ON image_counts.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id,
        COUNT(*)::int as videos_generated,
        COUNT(*) FILTER (WHERE status = 'completed')::int as videos_completed,
        COALESCE(SUM(actual_cost), 0)::int as video_cost_cents
      FROM video_project
      GROUP BY workspace_id
    ) video_counts ON video_counts.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, MAX(updated_at) as last_project_update
      FROM project
      GROUP BY workspace_id
    ) project_activity ON project_activity.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, MAX(updated_at) as last_video_update
      FROM video_project
      GROUP BY workspace_id
    ) video_activity ON video_activity.workspace_id = w.id
    WHERE 1=1
    ${filters?.status ? sql`AND w.status = ${filters.status}` : sql``}
    ${filters?.plan ? sql`AND w.plan = ${filters.plan}` : sql``}
    ${filters?.search ? sql`AND (
      w.name ILIKE ${'%' + filters.search + '%'} OR
      w.slug ILIKE ${'%' + filters.search + '%'} OR
      owner.email ILIKE ${'%' + filters.search + '%'} OR
      owner.name ILIKE ${'%' + filters.search + '%'}
    )` : sql``}
    ${cursor ? sql`AND w.id > ${cursor}` : sql``}
    ORDER BY ${
      sort?.[0] === "name" ? (sort[1] === "asc" ? sql`w.name ASC` : sql`w.name DESC`) :
      sort?.[0] === "memberCount" ? (sort[1] === "asc" ? sql`member_count ASC` : sql`member_count DESC`) :
      sort?.[0] === "imagesGenerated" ? (sort[1] === "asc" ? sql`images_generated ASC` : sql`images_generated DESC`) :
      sort?.[0] === "totalSpend" ? (sort[1] === "asc" ? sql`images_generated ASC` : sql`images_generated DESC`) :
      sort?.[0] === "lastActivityAt" ? (sort[1] === "asc" ? sql`last_activity_at ASC` : sql`last_activity_at DESC`) :
      sort?.[0] === "createdAt" ? (sort[1] === "asc" ? sql`w.created_at ASC` : sql`w.created_at DESC`) :
      sql`w.created_at DESC`
    }
    LIMIT ${limit + 1}
  `);

  // postgres-js returns the result directly as an array
  const rows = workspacesResult as unknown as AdminWorkspaceQueryRow[];
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);

  const result: AdminWorkspaceRow[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as WorkspaceStatus,
    plan: row.plan as WorkspacePlan,
    memberCount: Number(row.member_count) || 0,
    imagesGenerated: Number(row.images_generated) || 0,
    videosGenerated: Number(row.videos_generated) || 0,
    videosCompleted: Number(row.videos_completed) || 0,
    totalSpend: Math.round(Number(row.images_generated) * COST_PER_IMAGE * 100) / 100,
    totalVideoSpend: (Number(row.video_cost_cents) || 0) / 100,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerImage: row.owner_image,
    createdAt: new Date(row.created_at),
    lastActivityAt: new Date(row.last_activity_at),
  }));

  return {
    data: result,
    meta: {
      cursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
      hasMore,
      total: totalResult?.count || 0,
    },
  };
}

export async function getAdminWorkspaceById(
  workspaceId: string
): Promise<AdminWorkspaceRow | null> {
  // Use a direct query for single workspace
  const workspaceData = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!workspaceData[0]) {
    return null;
  }

  // Get owner
  const ownerData = await db
    .select()
    .from(user)
    .where(and(eq(user.workspaceId, workspaceId), eq(user.role, "owner")))
    .limit(1);

  // Get member count
  const [memberCount] = await db
    .select({ count: count() })
    .from(user)
    .where(eq(user.workspaceId, workspaceId));

  // Get image count
  const [imageCount] = await db
    .select({ total: sum(project.completedCount) })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  // Get last activity
  const [lastActivity] = await db
    .select({ lastUpdate: max(project.updatedAt) })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  const w = workspaceData[0];
  const owner = ownerData[0];
  const imagesGenerated = Number(imageCount?.total) || 0;

  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    status: w.status as WorkspaceStatus,
    plan: w.plan as WorkspacePlan,
    memberCount: memberCount?.count || 0,
    imagesGenerated,
    totalSpend: Math.round(imagesGenerated * COST_PER_IMAGE * 100) / 100,
    ownerId: owner?.id || null,
    ownerName: owner?.name || null,
    ownerEmail: owner?.email || null,
    ownerImage: owner?.image || null,
    createdAt: w.createdAt,
    lastActivityAt: lastActivity?.lastUpdate || w.updatedAt,
  };
}

export async function getAdminWorkspaceStats(): Promise<{
  total: number;
  active: number;
  suspended: number;
  trial: number;
  byPlan: { free: number; pro: number; enterprise: number };
}> {
  const [totalResult] = await db.select({ count: count() }).from(workspace);

  const [activeResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.status, "active"));

  const [suspendedResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.status, "suspended"));

  const [trialResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.status, "trial"));

  const [freeResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.plan, "free"));

  const [proResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.plan, "pro"));

  const [enterpriseResult] = await db
    .select({ count: count() })
    .from(workspace)
    .where(eq(workspace.plan, "enterprise"));

  return {
    total: totalResult?.count || 0,
    active: activeResult?.count || 0,
    suspended: suspendedResult?.count || 0,
    trial: trialResult?.count || 0,
    byPlan: {
      free: freeResult?.count || 0,
      pro: proResult?.count || 0,
      enterprise: enterpriseResult?.count || 0,
    },
  };
}

// Types for admin workspace detail
export interface AdminWorkspaceDetail {
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: WorkspaceStatus;
    plan: WorkspacePlan;
    organizationNumber: string | null;
    contactEmail: string | null;
    contactPerson: string | null;
    onboardingCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    suspendedAt: Date | null;
    suspendedReason: string | null;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  members: Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: string;
    createdAt: Date;
  }>;
  stats: {
    memberCount: number;
    imagesGenerated: number;
    videosGenerated: number;
    videosCompleted: number;
    totalImageSpend: number;
    totalVideoSpend: number;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    imageCount: number;
    completedCount: number;
    createdAt: Date;
  }>;
  recentVideos: Array<{
    id: string;
    name: string;
    status: string;
    clipCount: number;
    completedClipCount: number;
    createdAt: Date;
  }>;
}

export async function getAdminWorkspaceDetail(
  workspaceId: string
): Promise<AdminWorkspaceDetail | null> {
  // Get workspace
  const workspaceData = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  if (!workspaceData[0]) {
    return null;
  }

  const w = workspaceData[0];

  // Get all members
  const membersData = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.workspaceId, workspaceId))
    .orderBy(desc(user.createdAt));

  // Find owner
  const owner = membersData.find((m) => m.role === "owner");

  // Get image stats
  const [imageStats] = await db
    .select({ total: sum(project.completedCount) })
    .from(project)
    .where(eq(project.workspaceId, workspaceId));

  // Get video stats
  const [videoStats] = await db
    .select({
      total: count(),
      completed: sum(
        sql`CASE WHEN ${videoProject.status} = 'completed' THEN 1 ELSE 0 END`
      ),
      totalCost: sum(videoProject.actualCost),
    })
    .from(videoProject)
    .where(eq(videoProject.workspaceId, workspaceId));

  // Get recent projects (last 5)
  const recentProjectsData = await db
    .select({
      id: project.id,
      name: project.name,
      status: project.status,
      imageCount: project.imageCount,
      completedCount: project.completedCount,
      createdAt: project.createdAt,
    })
    .from(project)
    .where(eq(project.workspaceId, workspaceId))
    .orderBy(desc(project.createdAt))
    .limit(5);

  // Get recent videos (last 5)
  const recentVideosData = await db
    .select({
      id: videoProject.id,
      name: videoProject.name,
      status: videoProject.status,
      clipCount: videoProject.clipCount,
      completedClipCount: videoProject.completedClipCount,
      createdAt: videoProject.createdAt,
    })
    .from(videoProject)
    .where(eq(videoProject.workspaceId, workspaceId))
    .orderBy(desc(videoProject.createdAt))
    .limit(5);

  const imagesGenerated = Number(imageStats?.total) || 0;

  return {
    workspace: {
      id: w.id,
      name: w.name,
      slug: w.slug,
      status: w.status as WorkspaceStatus,
      plan: w.plan as WorkspacePlan,
      organizationNumber: w.organizationNumber,
      contactEmail: w.contactEmail,
      contactPerson: w.contactPerson,
      onboardingCompleted: w.onboardingCompleted,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      suspendedAt: w.suspendedAt,
      suspendedReason: w.suspendedReason,
    },
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          image: owner.image,
        }
      : null,
    members: membersData,
    stats: {
      memberCount: membersData.length,
      imagesGenerated,
      videosGenerated: Number(videoStats?.total) || 0,
      videosCompleted: Number(videoStats?.completed) || 0,
      totalImageSpend: Math.round(imagesGenerated * COST_PER_IMAGE * 100) / 100,
      totalVideoSpend: (Number(videoStats?.totalCost) || 0) / 100,
    },
    recentProjects: recentProjectsData,
    recentVideos: recentVideosData,
  };
}
