import { Suspense } from "react";
import { WorkspacesDataTable } from "@/components/admin/tables/workspaces/data-table";
import { WorkspacesPageHeader } from "@/components/admin/workspaces-page-header";
import { getAdminWorkspaces } from "@/lib/db/queries";
import type { WorkspacePlan, WorkspaceStatus } from "@/lib/db/schema";
import type { SortableWorkspaceColumn, SortDirection } from "@/lib/types/admin";

interface SearchParams {
  q?: string;
  status?: string;
  plan?: string;
  sort?: string;
  order?: string;
}

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Parse filters from URL
  const filters = {
    search: params.q || undefined,
    status: (params.status as WorkspaceStatus) || undefined,
    plan: (params.plan as WorkspacePlan) || undefined,
  };

  // Parse sort from URL
  const sort: [SortableWorkspaceColumn, SortDirection] | undefined =
    params.sort && params.order
      ? [params.sort as SortableWorkspaceColumn, params.order as SortDirection]
      : undefined;

  // Fetch initial data server-side
  const initialData = await getAdminWorkspaces({
    cursor: null,
    limit: 20,
    filters,
    sort,
  });

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <WorkspacesPageHeader />
      </div>

      {/* Data Table */}
      <div className="stagger-1 animate-fade-in-up">
        <Suspense>
          <WorkspacesDataTable
            initialData={initialData.data}
            initialMeta={initialData.meta}
          />
        </Suspense>
      </div>
    </div>
  );
}
