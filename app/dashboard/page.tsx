import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { auth } from "@/lib/auth";
import {
  getProjectStats,
  getProjects,
  getUserWithWorkspace,
} from "@/lib/db/queries";

export default async function DashboardPage() {
  // Get session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Get user with workspace
  const data = await getUserWithWorkspace(session.user.id);

  if (!data) {
    redirect("/onboarding");
  }

  // Fetch real data from database
  const projects = await getProjects(data.workspace.id);
  const stats = await getProjectStats(data.workspace.id);

  return (
    <Suspense>
      <DashboardContent projects={projects} stats={stats} />
    </Suspense>
  );
}
