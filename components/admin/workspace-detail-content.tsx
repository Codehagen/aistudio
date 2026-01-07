"use client";

import { format } from "date-fns";
import {
  IconUsers,
  IconPhoto,
  IconMovie,
  IconCurrencyDollar,
  IconMail,
  IconBuilding,
  IconUser,
  IconCalendar,
  IconUserCircle,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AdminWorkspaceDetail } from "@/lib/db/queries";
import type { WorkspaceStatus, WorkspacePlan } from "@/lib/db/schema";
import { useImpersonation } from "@/hooks/use-impersonation";

interface WorkspaceDetailContentProps {
  workspace: AdminWorkspaceDetail;
}

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

export function WorkspaceDetailContent({
  workspace: data,
}: WorkspaceDetailContentProps) {
  const { impersonateUser } = useImpersonation();
  const { workspace, owner, members, stats, recentProjects, recentVideos } =
    data;

  const totalSpend = stats.totalImageSpend + stats.totalVideoSpend;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            /{workspace.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariantMap[workspace.status]}>
            {statusLabelMap[workspace.status]}
          </Badge>
          <Badge variant={planVariantMap[workspace.plan]}>
            {planLabelMap[workspace.plan]}
          </Badge>
          {owner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => impersonateUser(owner.id)}
            >
              <IconUserCircle className="mr-2 h-4 w-4" />
              Impersonate Owner
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.memberCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Images</CardTitle>
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.imagesGenerated.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              ${stats.totalImageSpend.toFixed(2)} spent
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Videos</CardTitle>
            <IconMovie className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.videosGenerated}</div>
            <p className="text-xs text-muted-foreground">
              {stats.videosCompleted} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              style={{ color: "var(--accent-amber)" }}
            >
              ${totalSpend.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workspace Info */}
        <Card>
          <CardHeader>
            <CardTitle>Workspace Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {owner && (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {owner.image && (
                    <AvatarImage src={owner.image} alt={owner.name} />
                  )}
                  <AvatarFallback>
                    {owner.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{owner.name}</p>
                  <p className="text-sm text-muted-foreground">{owner.email}</p>
                </div>
              </div>
            )}
            <div className="grid gap-3 text-sm">
              {workspace.organizationNumber && (
                <div className="flex items-center gap-2">
                  <IconBuilding className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Org Number:</span>
                  <span className="font-mono">
                    {workspace.organizationNumber}
                  </span>
                </div>
              )}
              {workspace.contactEmail && (
                <div className="flex items-center gap-2">
                  <IconMail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Contact:</span>
                  <span>{workspace.contactEmail}</span>
                </div>
              )}
              {workspace.contactPerson && (
                <div className="flex items-center gap-2">
                  <IconUser className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Contact Person:</span>
                  <span>{workspace.contactPerson}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{format(workspace.createdAt, "MMM d, yyyy")}</span>
              </div>
            </div>
            {workspace.status === "suspended" && workspace.suspendedReason && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">Suspension Reason</p>
                <p className="text-muted-foreground">
                  {workspace.suspendedReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {member.image && (
                        <AvatarImage src={member.image} alt={member.name} />
                      )}
                      <AvatarFallback className="text-xs">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">No members</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.completedCount}/{project.imageCount} images
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        project.status === "completed"
                          ? "status-completed"
                          : project.status === "processing"
                            ? "status-active"
                            : "status-pending"
                      }
                    >
                      {project.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(project.createdAt, "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
              {recentProjects.length === 0 && (
                <p className="text-sm text-muted-foreground">No projects yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Videos */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{video.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {video.completedClipCount}/{video.clipCount} clips
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        video.status === "completed"
                          ? "status-completed"
                          : video.status === "generating" ||
                              video.status === "compiling"
                            ? "status-active"
                            : video.status === "failed"
                              ? "destructive"
                              : "status-pending"
                      }
                    >
                      {video.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(video.createdAt, "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
              {recentVideos.length === 0 && (
                <p className="text-sm text-muted-foreground">No videos yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
