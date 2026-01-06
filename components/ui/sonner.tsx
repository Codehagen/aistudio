"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { IconCircleCheck, IconInfoCircle, IconAlertTriangle, IconAlertOctagon, IconLoader } from "@tabler/icons-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <IconCircleCheck className="size-4" style={{ color: "var(--accent-green)" }} />
        ),
        info: (
          <IconInfoCircle className="size-4" style={{ color: "var(--accent-teal)" }} />
        ),
        warning: (
          <IconAlertTriangle className="size-4" style={{ color: "var(--accent-amber)" }} />
        ),
        error: (
          <IconAlertOctagon className="size-4" style={{ color: "var(--accent-red)" }} />
        ),
        loading: (
          <IconLoader className="size-4 animate-spin" style={{ color: "var(--accent-teal)" }} />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "color-mix(in oklch, var(--accent-green) 15%, var(--popover))",
          "--success-border": "color-mix(in oklch, var(--accent-green) 30%, var(--border))",
          "--success-text": "var(--popover-foreground)",
          "--error-bg": "color-mix(in oklch, var(--accent-red) 15%, var(--popover))",
          "--error-border": "color-mix(in oklch, var(--accent-red) 30%, var(--border))",
          "--error-text": "var(--popover-foreground)",
          "--warning-bg": "color-mix(in oklch, var(--accent-amber) 15%, var(--popover))",
          "--warning-border": "color-mix(in oklch, var(--accent-amber) 30%, var(--border))",
          "--warning-text": "var(--popover-foreground)",
          "--info-bg": "color-mix(in oklch, var(--accent-teal) 15%, var(--popover))",
          "--info-border": "color-mix(in oklch, var(--accent-teal) 30%, var(--border))",
          "--info-text": "var(--popover-foreground)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-lg ring-1 ring-foreground/10",
          title: "font-medium text-foreground",
          description: "!text-foreground !opacity-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
