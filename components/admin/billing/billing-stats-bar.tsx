"use client"

import {
  IconFileInvoice,
  IconClock,
  IconCheck,
  IconReceipt,
} from "@tabler/icons-react"
import { type BillingStats, formatNOK } from "@/lib/mock/admin-billing"

interface BillingStatsBarProps {
  stats: BillingStats
}

export function BillingStatsBar({ stats }: BillingStatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Uninvoiced */}
      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in oklch, var(--accent-amber) 15%, transparent)",
            }}
          >
            <IconClock className="h-5 w-5" style={{ color: "var(--accent-amber)" }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ikke fakturert</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--accent-amber)" }}
              >
                {stats.uninvoicedCount}
              </span>
              <span className="text-sm text-muted-foreground">prosjekter</span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-amber)" }}>
              {formatNOK(stats.uninvoicedAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Pending Payment */}
      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in oklch, var(--accent-teal) 15%, transparent)",
            }}
          >
            <IconFileInvoice
              className="h-5 w-5"
              style={{ color: "var(--accent-teal)" }}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Venter betaling</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--accent-teal)" }}
              >
                {stats.pendingPayment}
              </span>
              <span className="text-sm text-muted-foreground">fakturaer</span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-teal)" }}>
              {formatNOK(stats.pendingPaymentAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Invoiced This Month */}
      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in oklch, var(--accent-green) 15%, transparent)",
            }}
          >
            <IconCheck className="h-5 w-5" style={{ color: "var(--accent-green)" }} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Denne måneden</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--accent-green)" }}
              >
                {stats.invoicedThisMonth}
              </span>
              <span className="text-sm text-muted-foreground">fakturaer</span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-green)" }}>
              {formatNOK(stats.invoicedAmountThisMonth)}
            </p>
          </div>
        </div>
      </div>

      {/* Total Invoiced */}
      <div className="rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in oklch, var(--accent-violet) 15%, transparent)",
            }}
          >
            <IconReceipt
              className="h-5 w-5"
              style={{ color: "var(--accent-violet)" }}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Totalt fakturert</p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: "var(--accent-violet)" }}
              >
                {stats.invoicedCount}
              </span>
              <span className="text-sm text-muted-foreground">fakturaer</span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-violet)" }}>
              {formatNOK(stats.invoicedAmount)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
