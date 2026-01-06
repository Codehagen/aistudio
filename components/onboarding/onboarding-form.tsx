"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { IconLoader } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { completeOnboarding } from "@/lib/actions"

interface OnboardingFormProps {
  initialName: string
  initialEmail: string
  initialWorkspaceName: string
}

type FormState = {
  error?: string
} | null

export function OnboardingForm({
  initialName,
  initialEmail,
  initialWorkspaceName,
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prevState, formData) => {
      const name = formData.get("name") as string
      const workspaceName = formData.get("workspaceName") as string
      const organizationNumber = formData.get("organizationNumber") as string

      // Client-side validation
      if (!name.trim()) {
        return { error: "Please enter your name" }
      }

      if (!workspaceName.trim()) {
        return { error: "Please enter a workspace name" }
      }

      // Validate Norwegian org number format if provided (9 digits)
      if (organizationNumber && !/^\d{9}$/.test(organizationNumber)) {
        return { error: "Organization number must be 9 digits" }
      }

      try {
        // Server action will redirect on success
        await completeOnboarding(formData)
        return null
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Something went wrong",
        }
      }
    },
    null
  )

  // Show toast on error
  if (state?.error) {
    toast.error(state.error)
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Complete your profile</CardTitle>
        <CardDescription>
          Tell us a bit more about you and your company
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              defaultValue={initialName}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspaceName">Company / Workspace name</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              type="text"
              placeholder="Acme Real Estate"
              defaultValue={initialWorkspaceName}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationNumber">
              Organization number{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="organizationNumber"
              name="organizationNumber"
              type="text"
              placeholder="123456789"
              maxLength={9}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Norwegian organization number (9 digits)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">
              Contact email{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              placeholder="contact@company.com"
              defaultValue={initialEmail}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson">
              Contact person{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="contactPerson"
              name="contactPerson"
              type="text"
              placeholder="John Doe"
              defaultValue={initialName}
              disabled={isPending}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <IconLoader className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue to dashboard"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
