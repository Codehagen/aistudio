import { IconUsers } from "@tabler/icons-react";
import { Suspense } from "react";
import { UsersDataTable } from "@/components/admin/tables/users/data-table";
import { getAdminUsers } from "@/lib/db/queries";
import type {
  SortableUserColumn,
  SortDirection,
  UserRole,
  UserStatus,
} from "@/lib/types/admin";

interface AdminUsersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams;

  // Parse filters from URL
  const filters = {
    search: typeof params.q === "string" ? params.q : undefined,
    role:
      typeof params.role === "string" ? (params.role as UserRole) : undefined,
    status:
      typeof params.status === "string"
        ? (params.status as UserStatus)
        : undefined,
    workspaceId:
      typeof params.workspaceId === "string" ? params.workspaceId : undefined,
  };

  // Parse sort from URL
  const sortParam = params.sort;
  let sort: [SortableUserColumn, SortDirection] | undefined;
  if (Array.isArray(sortParam) && sortParam.length === 2) {
    sort = [sortParam[0] as SortableUserColumn, sortParam[1] as SortDirection];
  }

  // Fetch initial data server-side
  const initialData = await getAdminUsers({
    cursor: null,
    limit: 20,
    filters,
    sort,
  });

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8">
      {/* Page Header */}
      <div className="animate-fade-in-up space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ring-1 ring-white/10"
            style={{ backgroundColor: "var(--accent-teal)" }}
          >
            <IconUsers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tight">Users</h1>
            <p className="text-muted-foreground text-sm">
              Manage and monitor all users across workspaces
            </p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="stagger-1 animate-fade-in-up">
        <Suspense>
          <UsersDataTable
            initialData={initialData.data}
            initialMeta={initialData.meta}
          />
        </Suspense>
      </div>
    </div>
  );
}
