"use client"

import { useActionState, useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  IconBuilding,
  IconHash,
  IconMail,
  IconUser,
  IconDeviceFloppy,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Workspace } from "@/lib/db/schema"
import { updateWorkspaceSettings, type WorkspaceActionResult } from "@/lib/actions"

interface WorkspaceFormProps {
  workspace: Workspace
}

type FormState = WorkspaceActionResult | null

export function WorkspaceForm({ workspace }: WorkspaceFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const lastResultRef = useRef<FormState>(null)

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prevState, formData) => {
      const name = formData.get("name") as string

      // Client-side validation
      if (!name.trim()) {
        return { success: false, error: "Workspace name is required" }
      }

      const result = await updateWorkspaceSettings(formData)
      return result
    },
    null
  )

  // Show toast when state changes (only once per state change)
  useEffect(() => {
    if (state && state !== lastResultRef.current) {
      if (state.success) {
        toast.success("Changes saved successfully")
      } else if (state.error) {
        toast.error(state.error)
      }
      lastResultRef.current = state
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Logo upload */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Workspace Logo</Label>
        <div className="flex items-center gap-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted ring-1 ring-foreground/5"
            style={{
              background: workspace.logo
                ? `url(${workspace.logo}) center/cover`
                : "linear-gradient(135deg, color-mix(in oklch, var(--accent-teal) 20%, transparent) 0%, color-mix(in oklch, var(--accent-teal) 5%, transparent) 100%)",
            }}
          >
            {!workspace.logo && (
              <IconBuilding
                className="h-8 w-8"
                style={{ color: "var(--accent-teal)" }}
              />
            )}
          </div>
          <div className="space-y-1">
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <IconUpload className="h-4 w-4" />
              Upload Logo
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG, JPG up to 2MB. Recommended 200x200px.
            </p>
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Workspace Name */}
        <div className="space-y-2">
          <Label htmlFor="workspace-name" className="text-sm font-medium">
            Workspace Name
          </Label>
          <div className="relative">
            <IconBuilding className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="workspace-name"
              name="name"
              defaultValue={workspace.name}
              placeholder="Your company name"
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Organization Number */}
        <div className="space-y-2">
          <Label htmlFor="org-number" className="text-sm font-medium">
            Organization Number
          </Label>
          <div className="relative">
            <IconHash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="org-number"
              name="organizationNumber"
              defaultValue={workspace.organizationNumber || ""}
              placeholder="123456789"
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Contact Email */}
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="text-sm font-medium">
            Contact Email
          </Label>
          <div className="relative">
            <IconMail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contact-email"
              name="contactEmail"
              type="email"
              defaultValue={workspace.contactEmail || ""}
              placeholder="contact@company.com"
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Contact Person */}
        <div className="space-y-2">
          <Label htmlFor="contact-person" className="text-sm font-medium">
            Contact Person
          </Label>
          <div className="relative">
            <IconUser className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="contact-person"
              name="contactPerson"
              defaultValue={workspace.contactPerson || ""}
              placeholder="Full name"
              className="pl-10"
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end border-t pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className={cn("gap-2 transition-all shadow-sm")}
          style={{
            backgroundColor: "var(--accent-teal)",
          }}
        >
          {isPending ? (
            <>
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <IconDeviceFloppy className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
