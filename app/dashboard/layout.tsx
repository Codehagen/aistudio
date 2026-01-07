import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserWithWorkspace } from "@/lib/db/queries";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

export const metadata: Metadata = {
  title: "Dashboard | AI Studio",
  description: "Manage your property photos and AI edits",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate session server-side
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Get user with workspace
  const data = await getUserWithWorkspace(session.user.id);

  // If no workspace or onboarding not completed, redirect to onboarding
  if (!data || !data.workspace.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <DashboardHeader userLabel={session.user.email} />

      {/* Main content - full width with consistent padding */}
      <main className="w-full py-6">{children}</main>
    </div>
  );
}
