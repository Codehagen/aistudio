"use client"

import { useState, useMemo } from "react"
import {
  IconSend,
  IconFileInvoice,
  IconPhoto,
  IconBuilding,
  IconLoader2,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/ui/alert"
import {
  getUninvoicedProjects,
  getUninvoicedByWorkspace,
  formatNOK,
  type UninvoicedProject,
} from "@/lib/mock/admin-billing"

export function UninvoicedTable() {
  const projects = useMemo(() => getUninvoicedProjects(), [])
  const byWorkspace = useMemo(() => getUninvoicedByWorkspace(), [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSendingBatch, setIsSendingBatch] = useState(false)
  const [sendingSingleId, setSendingSingleId] = useState<string | null>(null)

  const allSelected =
    projects.length > 0 && selectedIds.size === projects.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)))
    }
  }

  const toggleProject = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // Group selected projects by workspace
  const selectedByWorkspace = useMemo(() => {
    const grouped = new Map<
      string,
      { workspaceName: string; orgNumber: string; projects: UninvoicedProject[] }
    >()

    projects
      .filter((p) => selectedIds.has(p.id))
      .forEach((p) => {
        const existing = grouped.get(p.workspaceId)
        if (existing) {
          existing.projects.push(p)
        } else {
          grouped.set(p.workspaceId, {
            workspaceName: p.workspaceName,
            orgNumber: p.workspaceOrgNumber,
            projects: [p],
          })
        }
      })

    return grouped
  }, [projects, selectedIds])

  const selectedTotal = useMemo(() => {
    return projects
      .filter((p) => selectedIds.has(p.id))
      .reduce((sum, p) => sum + p.amount, 0)
  }, [projects, selectedIds])

  const handleSendInvoices = async () => {
    setIsSendingBatch(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // For now, just log what would be sent
    console.log("Sending invoices for:", selectedByWorkspace)

    toast.success("Fakturaer sendt", {
      description: `${selectedIds.size} faktura(er) til ${selectedByWorkspace.size} kunde(r) for totalt ${formatNOK(selectedTotal)}`,
    })

    setSelectedIds(new Set())
    setIsSendingBatch(false)
  }

  const handleSendSingle = async (project: UninvoicedProject) => {
    setSendingSingleId(project.id)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    console.log("Sending single invoice for:", project)

    toast.success("Faktura sendt", {
      description: `${project.workspaceName} – ${formatNOK(project.amount)}`,
    })

    setSendingSingleId(null)
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--accent-green) 15%, transparent)",
          }}
        >
          <IconFileInvoice
            className="h-6 w-6"
            style={{ color: "var(--accent-green)" }}
          />
        </div>
        <h3 className="text-lg font-semibold">Alt er fakturert!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Det er ingen prosjekter som venter på fakturering.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Bar - Always visible to prevent layout shift */}
      <Alert className="border-border bg-muted/30">
        <IconFileInvoice className="h-4 w-4" />
        {selectedIds.size > 0 ? (
          <>
            <AlertTitle className="flex items-center gap-2">
              {selectedIds.size} prosjekt{selectedIds.size !== 1 ? "er" : ""} valgt
              <Badge variant="outline" className="font-mono font-normal">
                {formatNOK(selectedTotal)}
              </Badge>
            </AlertTitle>
            <AlertDescription>
              {selectedByWorkspace.size} faktura{selectedByWorkspace.size !== 1 ? "er" : ""} vil bli opprettet
            </AlertDescription>
          </>
        ) : (
          <>
            <AlertTitle>Velg prosjekter</AlertTitle>
            <AlertDescription>
              Klikk på en rad eller bruk avkrysningsboksene for å velge prosjekter
            </AlertDescription>
          </>
        )}
        <AlertAction>
          <Button
            onClick={handleSendInvoices}
            size="sm"
            disabled={selectedIds.size === 0 || isSendingBatch}
          >
            {isSendingBatch ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <IconSend className="mr-2 h-4 w-4" />
            )}
            {selectedIds.size > 0
              ? `Send ${selectedByWorkspace.size} faktura${selectedByWorkspace.size !== 1 ? "er" : ""}`
              : "Send faktura"}
          </Button>
        </AlertAction>
      </Alert>

      {/* Table */}
      <div className="rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected || (someSelected ? "indeterminate" : false)}
                  onCheckedChange={toggleAll}
                  aria-label="Velg alle"
                />
              </TableHead>
              <TableHead>Prosjekt</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead className="text-center">Bilder</TableHead>
              <TableHead className="text-right">Beløp</TableHead>
              <TableHead>Fullført</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow
                key={project.id}
                onClick={() => toggleProject(project.id)}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedIds.has(project.id) ? "bg-muted/30" : ""}`}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(project.id)}
                    onCheckedChange={() => toggleProject(project.id)}
                    aria-label={`Velg ${project.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {project.id}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{
                        backgroundColor:
                          "color-mix(in oklch, var(--accent-violet) 15%, transparent)",
                      }}
                    >
                      <IconBuilding
                        className="h-4 w-4"
                        style={{ color: "var(--accent-violet)" }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {project.workspaceName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Org: {project.workspaceOrgNumber}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <IconPhoto className="h-4 w-4 text-muted-foreground" />
                    <span className="tabular-nums">{project.imageCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className="font-mono font-semibold"
                    style={{ color: "var(--accent-amber)" }}
                  >
                    {formatNOK(project.amount)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {project.completedAt.toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendSingle(project)}
                    disabled={sendingSingleId === project.id}
                    className="h-8"
                  >
                    {sendingSingleId === project.id ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconSend className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          <span className="font-mono font-semibold" style={{ color: "var(--accent-amber)" }}>
            {projects.length}
          </span>{" "}
          prosjekter venter på fakturering
        </div>
      </div>
    </div>
  )
}
