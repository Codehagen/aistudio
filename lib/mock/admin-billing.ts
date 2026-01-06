import { getAllWorkspaces, type AdminWorkspace } from "./admin-workspaces"

// =============================================================================
// Types
// =============================================================================

export type ProjectStatus = "completed" | "invoiced"
export type InvoiceStatus = "pending" | "sent" | "paid"

export interface UninvoicedProject {
  id: string
  name: string
  workspaceId: string
  workspaceName: string
  workspaceOrgNumber: string
  imageCount: number
  amount: number // 1000 kr per project
  completedAt: Date
}

export interface InvoiceRecord {
  id: string
  fikenInvoiceId: number
  fikenInvoiceNumber: string
  workspaceId: string
  workspaceName: string
  workspaceOrgNumber: string
  projectCount: number
  projectNames: string[]
  amount: number // in kr
  amountWithVat: number // amount + 25% VAT
  status: InvoiceStatus
  issueDate: Date
  dueDate: Date
  createdAt: Date
}

export interface BillingStats {
  uninvoicedCount: number
  uninvoicedAmount: number
  invoicedCount: number
  invoicedAmount: number
  invoicedThisMonth: number
  invoicedAmountThisMonth: number
  pendingPayment: number
  pendingPaymentAmount: number
}

// =============================================================================
// Mock Data Generation
// =============================================================================

const projectNames = [
  "Storgata 15 - Leilighet",
  "Parkveien 8 - Enebolig",
  "Sjøgata 22 - Rekkehus",
  "Industrigata 5 - Kontor",
  "Havnegata 12 - Næringsbygg",
  "Fjordveien 3 - Hytte",
  "Bergveien 45 - Villa",
  "Sentrumsgate 1 - Butikklokale",
  "Skogstien 9 - Tomannsbolig",
  "Elvebakken 7 - Fritidsbolig",
  "Solsiden 18 - Penthouse",
  "Nordre gate 33 - Rekkehus",
  "Brygga 4 - Sjøhus",
  "Gamle vei 21 - Gårdsbruk",
  "Utsikten 11 - Moderne villa",
]

// Norwegian organization numbers (9 digits)
const orgNumbers = [
  "912345678",
  "987654321",
  "923456789",
  "934567890",
  "945678901",
  "956789012",
  "967890123",
  "978901234",
  "989012345",
  "990123456",
]

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

function generateUninvoicedProjects(): UninvoicedProject[] {
  const workspaces = getAllWorkspaces()
  const projects: UninvoicedProject[] = []
  const random = seededRandom(456)

  // Generate 2-4 uninvoiced projects per active workspace
  workspaces
    .filter((w) => w.status === "active")
    .slice(0, 15) // Limit to 15 workspaces
    .forEach((workspace, wsIndex) => {
      const projectCount = 1 + Math.floor(random() * 4) // 1-4 projects

      for (let i = 0; i < projectCount; i++) {
        const projectName =
          projectNames[Math.floor(random() * projectNames.length)]
        const imageCount = 3 + Math.floor(random() * 8) // 3-10 images

        // Completed within last 30 days
        const completedDaysAgo = Math.floor(random() * 30)
        const completedAt = new Date()
        completedAt.setDate(completedAt.getDate() - completedDaysAgo)

        projects.push({
          id: `proj_${String(wsIndex + 1).padStart(3, "0")}_${String(i + 1).padStart(2, "0")}`,
          name: projectName,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceOrgNumber: orgNumbers[wsIndex % orgNumbers.length],
          imageCount,
          amount: 1000, // Fixed 1000 kr per project
          completedAt,
        })
      }
    })

  // Sort by completedAt (newest first)
  return projects.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
}

function generateInvoiceHistory(): InvoiceRecord[] {
  const workspaces = getAllWorkspaces()
  const invoices: InvoiceRecord[] = []
  const random = seededRandom(789)

  // Generate 20-30 historical invoices
  const invoiceCount = 25
  const invoiceNumber = 10026 // Starting from our test invoices

  for (let i = 0; i < invoiceCount; i++) {
    const workspace = workspaces[Math.floor(random() * workspaces.length)]
    const projectCount = 1 + Math.floor(random() * 5) // 1-5 projects per invoice

    // Generate project names for this invoice
    const invoiceProjectNames: string[] = []
    for (let j = 0; j < projectCount; j++) {
      invoiceProjectNames.push(
        projectNames[Math.floor(random() * projectNames.length)]
      )
    }

    const amount = projectCount * 1000 // 1000 kr per project
    const amountWithVat = amount * 1.25 // 25% VAT

    // Status distribution: 60% paid, 30% sent, 10% pending
    const statusRoll = random()
    const status: InvoiceStatus =
      statusRoll < 0.6 ? "paid" : statusRoll < 0.9 ? "sent" : "pending"

    // Issue date: within last 90 days
    const issueDaysAgo = Math.floor(random() * 90)
    const issueDate = new Date()
    issueDate.setDate(issueDate.getDate() - issueDaysAgo)

    // Due date: 14 days after issue
    const dueDate = new Date(issueDate)
    dueDate.setDate(dueDate.getDate() + 14)

    invoices.push({
      id: `inv_${String(i + 1).padStart(4, "0")}`,
      fikenInvoiceId: 11305900000 + i,
      fikenInvoiceNumber: String(invoiceNumber + i),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceOrgNumber: orgNumbers[i % orgNumbers.length],
      projectCount,
      projectNames: invoiceProjectNames,
      amount,
      amountWithVat,
      status,
      issueDate,
      dueDate,
      createdAt: issueDate,
    })
  }

  // Sort by issueDate (newest first)
  return invoices.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
}

// =============================================================================
// Cached Data
// =============================================================================

const mockUninvoicedProjects = generateUninvoicedProjects()
const mockInvoiceHistory = generateInvoiceHistory()

// =============================================================================
// Public API
// =============================================================================

export function getUninvoicedProjects(): UninvoicedProject[] {
  return mockUninvoicedProjects
}

export function getInvoiceHistory(): InvoiceRecord[] {
  return mockInvoiceHistory
}

export function getBillingStats(): BillingStats {
  const uninvoiced = mockUninvoicedProjects
  const invoices = mockInvoiceHistory

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const invoicesThisMonth = invoices.filter(
    (inv) => inv.issueDate >= startOfMonth
  )
  const pendingInvoices = invoices.filter((inv) => inv.status !== "paid")

  return {
    uninvoicedCount: uninvoiced.length,
    uninvoicedAmount: uninvoiced.reduce((sum, p) => sum + p.amount, 0),
    invoicedCount: invoices.length,
    invoicedAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    invoicedThisMonth: invoicesThisMonth.length,
    invoicedAmountThisMonth: invoicesThisMonth.reduce(
      (sum, inv) => sum + inv.amount,
      0
    ),
    pendingPayment: pendingInvoices.length,
    pendingPaymentAmount: pendingInvoices.reduce(
      (sum, inv) => sum + inv.amount,
      0
    ),
  }
}

// Group uninvoiced projects by workspace for batch invoicing
export function getUninvoicedByWorkspace(): Map<
  string,
  {
    workspace: { id: string; name: string; orgNumber: string }
    projects: UninvoicedProject[]
    totalAmount: number
  }
> {
  const grouped = new Map<
    string,
    {
      workspace: { id: string; name: string; orgNumber: string }
      projects: UninvoicedProject[]
      totalAmount: number
    }
  >()

  for (const project of mockUninvoicedProjects) {
    const existing = grouped.get(project.workspaceId)

    if (existing) {
      existing.projects.push(project)
      existing.totalAmount += project.amount
    } else {
      grouped.set(project.workspaceId, {
        workspace: {
          id: project.workspaceId,
          name: project.workspaceName,
          orgNumber: project.workspaceOrgNumber,
        },
        projects: [project],
        totalAmount: project.amount,
      })
    }
  }

  return grouped
}

// Format amount in NOK
export function formatNOK(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
