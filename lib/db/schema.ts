import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

// ============================================================================
// Workspace (must be defined before user due to foreign key reference)
// ============================================================================

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),

  // Company details (collected during onboarding)
  organizationNumber: text("organization_number"), // Norwegian org number (9 digits)
  contactEmail: text("contact_email"),
  contactPerson: text("contact_person"),

  // White-label branding
  logo: text("logo"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),

  // Onboarding status
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),

  // Admin/billing fields
  status: text("status").notNull().default("active"), // "active" | "suspended" | "trial"
  plan: text("plan").notNull().default("free"), // "free" | "pro" | "enterprise"
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// Better-Auth Tables
// ============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Workspace relation
  workspaceId: text("workspace_id").references(() => workspace.id, {
    onDelete: "cascade",
  }),
  role: text("role").notNull().default("member"), // "owner" | "admin" | "member"

  // System admin flag (for super admin access across all workspaces)
  isSystemAdmin: boolean("is_system_admin").notNull().default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Admin impersonation tracking (better-auth admin plugin)
    impersonatedBy: text("impersonated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// ============================================================================
// Project (groups multiple image generations)
// ============================================================================

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Project details
    name: text("name").notNull(),
    styleTemplateId: text("style_template_id").notNull(),
    roomType: text("room_type"), // living-room | bedroom | kitchen | bathroom | dining-room | office | exterior | etc (Comprehensive list in RoomType)
    thumbnailUrl: text("thumbnail_url"),

    // Status tracking
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed

    // Image counts (denormalized for performance)
    imageCount: integer("image_count").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("project_workspace_idx").on(table.workspaceId),
    index("project_user_idx").on(table.userId),
    index("project_status_idx").on(table.status),
  ]
);

// ============================================================================
// Image Generation
// ============================================================================

export const imageGeneration = pgTable(
  "image_generation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    // Image data
    originalImageUrl: text("original_image_url").notNull(),
    resultImageUrl: text("result_image_url"),
    prompt: text("prompt").notNull(),

    // Version tracking for edit history
    version: integer("version").notNull().default(1), // v1, v2, v3...
    parentId: text("parent_id"), // Links to original image for version chain

    // Status tracking
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed
    errorMessage: text("error_message"),

    // Metadata (model used, tokens, cost, etc.)
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("image_generation_workspace_idx").on(table.workspaceId),
    index("image_generation_user_idx").on(table.userId),
    index("image_generation_project_idx").on(table.projectId),
    index("image_generation_parent_idx").on(table.parentId),
  ]
);

// ============================================================================
// Video Project
// ============================================================================

export const videoProject = pgTable(
  "video_project",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Video details
    name: text("name").notNull(),
    description: text("description"),

    // Settings
    aspectRatio: text("aspect_ratio").notNull().default("16:9"), // "16:9" | "9:16" | "1:1"
    musicTrackId: text("music_track_id"), // FK to music_track or null for no music
    musicVolume: integer("music_volume").notNull().default(50), // 0-100
    generateNativeAudio: boolean("generate_native_audio").notNull().default(true),

    // Output
    finalVideoUrl: text("final_video_url"),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"), // Total video duration

    // Status tracking
    status: text("status").notNull().default("draft"), // draft | generating | compiling | completed | failed

    // Cost tracking (denormalized for performance)
    clipCount: integer("clip_count").notNull().default(0),
    completedClipCount: integer("completed_clip_count").notNull().default(0),
    estimatedCost: integer("estimated_cost").notNull().default(0), // In cents ($0.35 = 35)
    actualCost: integer("actual_cost"), // In cents

    // Error handling
    errorMessage: text("error_message"),

    // Trigger.dev integration (for real-time progress)
    triggerRunId: text("trigger_run_id"),
    triggerAccessToken: text("trigger_access_token"),

    // Metadata (runId for tracking, etc.)
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("video_project_workspace_idx").on(table.workspaceId),
    index("video_project_user_idx").on(table.userId),
    index("video_project_status_idx").on(table.status),
  ]
);

// ============================================================================
// Video Clip (individual 5-second clips for each image)
// ============================================================================

export const videoClip = pgTable(
  "video_clip",
  {
    id: text("id").primaryKey(),
    videoProjectId: text("video_project_id")
      .notNull()
      .references(() => videoProject.id, { onDelete: "cascade" }),

    // Source image (can be from imageGeneration or external URL)
    sourceImageUrl: text("source_image_url").notNull(),
    imageGenerationId: text("image_generation_id").references(
      () => imageGeneration.id,
      { onDelete: "set null" }
    ),

    // Room type for sequencing
    roomType: text("room_type").notNull(), // stue | soverom | kjokken | bad | etc (English keys used internally)
    roomLabel: text("room_label"), // Custom label like "Master Bedroom", "Front Yard"

    // Sequence order
    sequenceOrder: integer("sequence_order").notNull(),

    // AI generation settings
    motionPrompt: text("motion_prompt"), // Motion description for Kling

    // Output
    clipUrl: text("clip_url"), // Kling output URL
    durationSeconds: integer("duration_seconds").notNull().default(5),

    // Status tracking
    status: text("status").notNull().default("pending"), // pending | processing | completed | failed
    errorMessage: text("error_message"),

    // Metadata (runId for real-time tracking, Kling response, etc.)
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("video_clip_project_idx").on(table.videoProjectId),
    index("video_clip_sequence_idx").on(table.videoProjectId, table.sequenceOrder),
    index("video_clip_status_idx").on(table.status),
  ]
);

// ============================================================================
// Music Track (pre-curated royalty-free tracks)
// ============================================================================

export const musicTrack = pgTable(
  "music_track",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    artist: text("artist"),

    // Categorization
    category: text("category").notNull(), // modern | classical | upbeat | calm | cinematic
    mood: text("mood"), // energetic | relaxing | professional | warm | elegant

    // File info
    audioUrl: text("audio_url").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    bpm: integer("bpm"), // Beats per minute for tempo matching

    // Preview
    previewUrl: text("preview_url"), // Short preview clip
    waveformUrl: text("waveform_url"), // Visual waveform image

    // Licensing
    licenseType: text("license_type").notNull().default("royalty-free"),
    attribution: text("attribution"), // Required attribution text if any

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("music_track_category_idx").on(table.category)]
);

// ============================================================================
// Type Exports
// ============================================================================

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type ImageGeneration = typeof imageGeneration.$inferSelect;
export type NewImageGeneration = typeof imageGeneration.$inferInsert;

export type VideoProject = typeof videoProject.$inferSelect;
export type NewVideoProject = typeof videoProject.$inferInsert;

export type VideoClip = typeof videoClip.$inferSelect;
export type NewVideoClip = typeof videoClip.$inferInsert;

export type MusicTrack = typeof musicTrack.$inferSelect;
export type NewMusicTrack = typeof musicTrack.$inferInsert;

export type UserRole = "owner" | "admin" | "member";
export type WorkspaceStatus = "active" | "suspended" | "trial";
export type WorkspacePlan = "free" | "pro" | "enterprise";
export type ProjectStatus = "pending" | "processing" | "completed" | "failed";
export type ImageStatus = "pending" | "processing" | "completed" | "failed";

// Comprehensive Room Types (English keys, Norwegian UI labels)
export type RoomType =
  | "living-room"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "toilet"
  | "hallway"
  | "office"
  | "laundry-room"
  | "storage-room"
  | "walk-in-closet"
  | "sauna"
  | "gym"
  | "childrens-room"
  | "pool-area"
  | "dining-room"
  | "tv-room"
  | "library"
  | "hobby-room"
  | "utility-room"
  | "pantry"
  | "conservatory"
  | "garage"
  | "terrace"
  | "garden"
  | "landscape"
  | "exterior"
  | "other";

// Video types
export type VideoProjectStatus = "draft" | "generating" | "compiling" | "completed" | "failed";
export type VideoClipStatus = "pending" | "processing" | "completed" | "failed";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";
export type MusicCategory = "modern" | "classical" | "upbeat" | "calm" | "cinematic";
export type VideoRoomType = RoomType; // Unified with RoomType for consistency

// ============================================================================
// BILLING SCHEMA (TODO: Uncomment when ready to implement)
// ============================================================================

/*
export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Fiken reference
    fikenInvoiceId: integer("fiken_invoice_id"),
    fikenInvoiceNumber: text("fiken_invoice_number"),

    // Invoice details
    amount: integer("amount").notNull(), // Amount in øre (Norwegian cents)
    currency: text("currency").notNull().default("NOK"),

    // Status: pending | sent | paid | cancelled
    status: text("status").notNull().default("pending"),

    // Dates
    issueDate: timestamp("issue_date").notNull(),
    dueDate: timestamp("due_date").notNull(),

    // Metadata
    description: text("description"),
    projectIds: jsonb("project_ids").$type<string[]>(), // Array of project IDs included

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_workspace_idx").on(table.workspaceId),
    index("invoice_status_idx").on(table.status),
    index("invoice_fiken_idx").on(table.fikenInvoiceId),
  ]
);

export type Invoice = typeof invoice.$inferSelect;
export type NewInvoice = typeof invoice.$inferInsert;
export type InvoiceStatus = "pending" | "sent" | "paid" | "cancelled";
*/
