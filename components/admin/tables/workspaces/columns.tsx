"use client";

import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminWorkspaceRow } from "@/lib/types/admin";
import type { WorkspaceStatus, WorkspacePlan } from "@/lib/db/schema";
import {
  IconDotsVertical,
  IconEye,
  IconUserCircle,
  IconBan,
} from "@tabler/icons-react";
import type { ColumnDef } from "@tanstack/react-table";
import { memo } from "react";

// Status badge variants
const statusVariantMap: Record<
  WorkspaceStatus,
  "status-active" | "status-suspended" | "status-trial"
> = {
  active: "status-active",
  suspended: "status-suspended",
  trial: "status-trial",
};

const statusLabelMap: Record<WorkspaceStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  trial: "Trial",
};

// Plan badge variants
const planVariantMap: Record<
  WorkspacePlan,
  "plan-free" | "plan-pro" | "plan-enterprise"
> = {
  free: "plan-free",
  pro: "plan-pro",
  enterprise: "plan-enterprise",
};

const planLabelMap: Record<WorkspacePlan, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

// Memoized cell components
const WorkspaceCell = memo(({ name, slug }: { name: string; slug: string }) => (
  <div className="flex flex-col min-w-0">
    <span className="font-medium truncate">{name}</span>
    <span className="text-xs text-muted-foreground truncate font-mono">
      /{slug}
    </span>
  </div>
));
WorkspaceCell.displayName = "WorkspaceCell";

const OwnerCell = memo(
  ({
    name,
    email,
    image,
  }: {
    name: string | null;
    email: string | null;
    image: string | null;
  }) => {
    if (!name || !email) {
      return (
        <span className="text-sm text-muted-foreground italic">No owner</span>
      );
    }

    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar className="h-7 w-7 shrink-0">
          {image && <AvatarImage src={image} alt={name} />}
          <AvatarFallback className="text-[10px] font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground truncate">
            {email}
          </span>
        </div>
      </div>
    );
  },
);
OwnerCell.displayName = "OwnerCell";

const MemberCountCell = memo(({ count }: { count: number }) => (
  <Badge variant="secondary" className="font-mono">
    {count}
  </Badge>
));
MemberCountCell.displayName = "MemberCountCell";

const ImagesCell = memo(({ count }: { count: number }) => (
  <span className="font-mono text-sm">{count.toLocaleString()}</span>
));
ImagesCell.displayName = "ImagesCell";

const VideosCell = memo(({ count }: { count: number }) => (
  <span className="font-mono text-sm">{count.toLocaleString()}</span>
));
VideosCell.displayName = "VideosCell";

const StatusCell = memo(({ status }: { status: WorkspaceStatus }) => (
  <Badge variant={statusVariantMap[status]}>{statusLabelMap[status]}</Badge>
));
StatusCell.displayName = "StatusCell";

const PlanCell = memo(({ plan }: { plan: WorkspacePlan }) => (
  <Badge variant={planVariantMap[plan]}>{planLabelMap[plan]}</Badge>
));
PlanCell.displayName = "PlanCell";

const SpendCell = memo(({ amount }: { amount: number }) => (
  <span
    className="font-mono text-sm font-medium"
    style={{ color: "var(--accent-amber)" }}
  >
    ${amount.toFixed(2)}
  </span>
));
SpendCell.displayName = "SpendCell";

const DateCell = memo(({ date }: { date: Date }) => {
  const formatted = format(date, "MMM d, yyyy");
  return <span className="text-sm text-muted-foreground">{formatted}</span>;
});
DateCell.displayName = "DateCell";

const ActionsCell = memo(
  ({
    workspaceId,
    ownerId,
    ownerName,
    ownerEmail,
    workspaceName,
    onImpersonate,
  }: {
    workspaceId: string;
    ownerId: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
    workspaceName: string;
    onImpersonate?: (user: {
      id: string;
      name: string;
      email: string;
      workspaceId: string;
      workspaceName: string;
    }) => void;
  }) => {
    const canImpersonate = ownerId && ownerName && ownerEmail;

    return (
      <div className="flex items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <IconDotsVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/workspaces/${workspaceId}`}>
                <IconEye className="mr-2 h-4 w-4" />
                View details
              </Link>
            </DropdownMenuItem>
            {canImpersonate && (
              <DropdownMenuItem
                onClick={() => {
                  if (onImpersonate) {
                    onImpersonate({
                      id: ownerId,
                      name: ownerName,
                      email: ownerEmail,
                      workspaceId,
                      workspaceName,
                    });
                  }
                }}
              >
                <IconUserCircle className="mr-2 h-4 w-4" />
                Impersonate owner
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => console.log("Suspend", workspaceId)}
              className="text-destructive focus:text-destructive"
            >
              <IconBan className="mr-2 h-4 w-4" />
              Suspend workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
ActionsCell.displayName = "ActionsCell";

export function createWorkspaceColumns(
  onImpersonate?: (user: {
    id: string;
    name: string;
    email: string;
    workspaceId: string;
    workspaceName: string;
  }) => void,
): ColumnDef<AdminWorkspaceRow>[] {
  return [
    {
      id: "workspace",
      accessorKey: "name",
      header: "Workspace",
      size: 220,
      minSize: 180,
      cell: ({ row }) => (
        <WorkspaceCell name={row.original.name} slug={row.original.slug} />
      ),
    },
    {
      id: "owner",
      accessorKey: "ownerName",
      header: "Owner",
      size: 220,
      minSize: 180,
      cell: ({ row }) => (
        <OwnerCell
          name={row.original.ownerName}
          email={row.original.ownerEmail}
          image={row.original.ownerImage}
        />
      ),
    },
    {
      id: "memberCount",
      accessorKey: "memberCount",
      header: "Members",
      size: 90,
      minSize: 70,
      maxSize: 100,
      cell: ({ row }) => <MemberCountCell count={row.original.memberCount} />,
    },
    {
      id: "imagesGenerated",
      accessorKey: "imagesGenerated",
      header: "Images",
      size: 90,
      minSize: 70,
      maxSize: 100,
      cell: ({ row }) => <ImagesCell count={row.original.imagesGenerated} />,
    },
    {
      id: "videosGenerated",
      accessorKey: "videosGenerated",
      header: "Videos",
      size: 90,
      minSize: 70,
      maxSize: 100,
      cell: ({ row }) => <VideosCell count={row.original.videosGenerated} />,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      size: 110,
      minSize: 90,
      maxSize: 130,
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: "plan",
      accessorKey: "plan",
      header: "Plan",
      size: 110,
      minSize: 90,
      maxSize: 130,
      cell: ({ row }) => <PlanCell plan={row.original.plan} />,
    },
    {
      id: "totalSpend",
      accessorKey: "totalSpend",
      header: "Spend",
      size: 100,
      minSize: 80,
      maxSize: 120,
      cell: ({ row }) => <SpendCell amount={row.original.totalSpend} />,
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Created",
      size: 120,
      minSize: 100,
      maxSize: 140,
      cell: ({ row }) => <DateCell date={row.original.createdAt} />,
    },
    {
      id: "actions",
      header: "",
      size: 60,
      minSize: 60,
      maxSize: 60,
      enableResizing: false,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <ActionsCell
          workspaceId={row.original.id}
          ownerId={row.original.ownerId}
          ownerName={row.original.ownerName}
          ownerEmail={row.original.ownerEmail}
          workspaceName={row.original.name}
          onImpersonate={onImpersonate}
        />
      ),
    },
  ];
}
