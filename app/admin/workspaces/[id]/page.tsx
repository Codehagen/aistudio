import { notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { requireSystemAdmin } from "@/lib/admin-auth";
import { getAdminWorkspaceDetail } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { WorkspaceDetailContent } from "@/components/admin/workspace-detail-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminWorkspaceDetailPage({ params }: PageProps) {
  await requireSystemAdmin();
  const { id } = await params;

  const data = await getAdminWorkspaceDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/workspaces">
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspaces
          </Link>
        </Button>
      </div>

      <WorkspaceDetailContent workspace={data} />
    </div>
  );
}
