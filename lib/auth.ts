import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (refresh session if older than this)
  },
  plugins: [
    admin({
      impersonationSessionDuration: 60 * 60 * 24, // 1 day
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create workspace automatically when user signs up
          const slug = user.email
            .split("@")[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-");
          const workspaceId = nanoid();

          await db.insert(schema.workspace).values({
            id: workspaceId,
            name: `${user.name}'s Workspace`,
            slug: `${slug}-${workspaceId.slice(0, 6)}`,
          });

          // Update user with workspaceId and set as owner
          await db
            .update(schema.user)
            .set({ workspaceId, role: "owner" })
            .where(eq(schema.user.id, user.id));
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
