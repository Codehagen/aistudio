import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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

  // Invoice eligibility (for Norwegian B2B customers)
  invoiceEligible: boolean("invoice_eligible").notNull().default(false),
  invoiceEligibleAt: timestamp("invoice_eligible_at"),
  invitedByAdmin: boolean("invited_by_admin").notNull().default(false),

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

  // Better-auth admin plugin fields
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
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
// Invitation (workspace invitations)
// ============================================================================

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"), // "owner" | "admin" | "member"
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("invitation_email_idx").on(table.email),
    index("invitation_token_idx").on(table.token),
    index("invitation_workspace_idx").on(table.workspaceId),
  ]
);

export type Invitation = typeof invitation.$inferSelect;
export type NewInvitation = typeof invitation.$inferInsert;

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
    generateNativeAudio: boolean("generate_native_audio")
      .notNull()
      .default(true),

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

    // End image (optional, falls back to sourceImageUrl if null)
    endImageUrl: text("end_image_url"),
    endImageGenerationId: text("end_image_generation_id").references(
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

    // Transition settings
    transitionType: text("transition_type").notNull().default("seamless"), // "cut" | "seamless"
    transitionClipUrl: text("transition_clip_url"), // Generated transition video URL

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
    index("video_clip_sequence_idx").on(
      table.videoProjectId,
      table.sequenceOrder
    ),
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
export type VideoProjectStatus =
  | "draft"
  | "generating"
  | "compiling"
  | "completed"
  | "failed";
export type VideoClipStatus = "pending" | "processing" | "completed" | "failed";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1";
export type MusicCategory =
  | "modern"
  | "classical"
  | "upbeat"
  | "calm"
  | "cinematic";
export type VideoRoomType = RoomType; // Unified with RoomType for consistency

// ============================================================================
// BILLING SCHEMA
// ============================================================================

/**
 * Workspace Pricing - Custom pricing per workspace
 * If null, defaults to BILLING_DEFAULTS in fiken-client.ts (1000 NOK)
 */
export const workspacePricing = pgTable(
  "workspace_pricing",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Custom pricing (null = use defaults: 100000 ore = 1000 NOK)
    imageProjectPriceOre: integer("image_project_price_ore"), // in ore (100000 = 1000 NOK)
    videoProjectPriceOre: integer("video_project_price_ore"), // in ore

    // Cached Fiken contact ID for faster invoice creation
    fikenContactId: integer("fiken_contact_id"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("workspace_pricing_workspace_idx").on(table.workspaceId)]
);

/**
 * Invoice - Groups invoice line items for billing
 */
export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Fiken integration
    fikenInvoiceId: integer("fiken_invoice_id"),
    fikenInvoiceNumber: text("fiken_invoice_number"),
    fikenContactId: integer("fiken_contact_id"),

    // Invoice totals
    totalAmountOre: integer("total_amount_ore").notNull(), // Sum of line items in ore
    currency: text("currency").notNull().default("NOK"),

    // Status: draft | sent | paid | cancelled | overdue
    status: text("status").notNull().default("draft"),

    // Dates
    issueDate: timestamp("issue_date"),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),

    // Notes
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_workspace_idx").on(table.workspaceId),
    index("invoice_status_idx").on(table.status),
    index("invoice_fiken_idx").on(table.fikenInvoiceId),
  ]
);

/**
 * Invoice Line Item - Individual billable items (projects/videos)
 * Created when a project is started, linked to invoice when billed
 */
export const invoiceLineItem = pgTable(
  "invoice_line_item",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Reference to billable item (one of these should be set)
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    videoProjectId: text("video_project_id").references(() => videoProject.id, {
      onDelete: "set null",
    }),

    // Line item details
    description: text("description").notNull(),
    amountOre: integer("amount_ore").notNull(), // Amount in ore
    quantity: integer("quantity").notNull().default(1),

    // Status: pending (awaiting invoice) | invoiced (included in invoice) | cancelled
    status: text("status").notNull().default("pending"),

    // Link to invoice when included
    invoiceId: text("invoice_id").references(() => invoice.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("invoice_line_item_workspace_idx").on(table.workspaceId),
    index("invoice_line_item_status_idx").on(table.status),
    index("invoice_line_item_invoice_idx").on(table.invoiceId),
    index("invoice_line_item_project_idx").on(table.projectId),
    index("invoice_line_item_video_idx").on(table.videoProjectId),
  ]
);

// ============================================================================
// AFFILIATE SCHEMA
// ============================================================================

/**
 * Affiliate Relationship - Links affiliate workspace to referred workspace
 * Manual assignment by admin with flexible commission percentage
 */
export const affiliateRelationship = pgTable(
  "affiliate_relationship",
  {
    id: text("id").primaryKey(),

    // The affiliate (earns commission)
    affiliateWorkspaceId: text("affiliate_workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // The referred workspace (generates revenue for affiliate)
    referredWorkspaceId: text("referred_workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Commission percentage (e.g., 20 = 20%, 50 = 50%)
    commissionPercent: integer("commission_percent").notNull().default(20),

    // Active status (can be deactivated without deleting)
    isActive: boolean("is_active").notNull().default(true),

    // Notes for admin
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("affiliate_relationship_affiliate_idx").on(
      table.affiliateWorkspaceId
    ),
    index("affiliate_relationship_referred_idx").on(table.referredWorkspaceId),
  ]
);

/**
 * Affiliate Earning - Commission earned when referred workspace invoice is paid
 */
export const affiliateEarning = pgTable(
  "affiliate_earning",
  {
    id: text("id").primaryKey(),

    // The affiliate earning this commission
    affiliateWorkspaceId: text("affiliate_workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Link to the relationship
    affiliateRelationshipId: text("affiliate_relationship_id")
      .notNull()
      .references(() => affiliateRelationship.id, { onDelete: "cascade" }),

    // The invoice that generated this earning
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),

    // Earning details
    invoiceAmountOre: integer("invoice_amount_ore").notNull(), // Original invoice amount
    commissionPercent: integer("commission_percent").notNull(), // Snapshot of % at time of earning
    earningAmountOre: integer("earning_amount_ore").notNull(), // Calculated commission

    // Payout status: pending | paid_out
    status: text("status").notNull().default("pending"),
    paidOutAt: timestamp("paid_out_at"),
    paidOutReference: text("paid_out_reference"), // Bank transfer ref, invoice ref, etc.

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("affiliate_earning_affiliate_idx").on(table.affiliateWorkspaceId),
    index("affiliate_earning_invoice_idx").on(table.invoiceId),
    index("affiliate_earning_status_idx").on(table.status),
  ]
);

// Billing type exports
export type WorkspacePricing = typeof workspacePricing.$inferSelect;
export type NewWorkspacePricing = typeof workspacePricing.$inferInsert;

export type Invoice = typeof invoice.$inferSelect;
export type NewInvoice = typeof invoice.$inferInsert;
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled" | "overdue";

export type InvoiceLineItem = typeof invoiceLineItem.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItem.$inferInsert;
export type LineItemStatus = "pending" | "invoiced" | "cancelled";

export type AffiliateRelationship = typeof affiliateRelationship.$inferSelect;
export type NewAffiliateRelationship =
  typeof affiliateRelationship.$inferInsert;

export type AffiliateEarning = typeof affiliateEarning.$inferSelect;
export type NewAffiliateEarning = typeof affiliateEarning.$inferInsert;
export type AffiliateEarningStatus = "pending" | "paid_out";

// ============================================================================
// STRIPE PAYMENT SCHEMA
// ============================================================================

/**
 * Stripe Customer - Links workspace to Stripe customer ID
 */
export const stripeCustomer = pgTable(
  "stripe_customer",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .unique()
      .references(() => workspace.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(), // cus_xxx
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("stripe_customer_workspace_idx").on(table.workspaceId),
    index("stripe_customer_stripe_idx").on(table.stripeCustomerId),
  ]
);

/**
 * Project Payment - Tracks payment for each project
 * Payment must be completed before AI processing begins
 */
export const projectPayment = pgTable(
  "project_payment",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .unique()
      .references(() => project.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Payment method: 'stripe' | 'invoice' | 'free'
    paymentMethod: text("payment_method").notNull(),

    // Stripe fields (for payment_method = 'stripe')
    stripeCheckoutSessionId: text("stripe_checkout_session_id"), // cs_xxx
    stripePaymentIntentId: text("stripe_payment_intent_id"), // pi_xxx

    // Invoice fields (for payment_method = 'invoice')
    invoiceLineItemId: text("invoice_line_item_id").references(
      () => invoiceLineItem.id,
      { onDelete: "set null" }
    ),

    // Amounts
    amountCents: integer("amount_cents").notNull(), // 9900 = $99 USD or 100000 = 1000 NOK
    currency: text("currency").notNull(), // 'usd' | 'nok'

    // Status: 'pending' | 'completed' | 'failed' | 'refunded'
    status: text("status").notNull().default("pending"),

    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("project_payment_project_idx").on(table.projectId),
    index("project_payment_workspace_idx").on(table.workspaceId),
    index("project_payment_status_idx").on(table.status),
    index("project_payment_stripe_session_idx").on(
      table.stripeCheckoutSessionId
    ),
  ]
);

// Stripe type exports
export type StripeCustomer = typeof stripeCustomer.$inferSelect;
export type NewStripeCustomer = typeof stripeCustomer.$inferInsert;

export type ProjectPayment = typeof projectPayment.$inferSelect;
export type NewProjectPayment = typeof projectPayment.$inferInsert;
export type PaymentMethod = "stripe" | "invoice" | "free";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
