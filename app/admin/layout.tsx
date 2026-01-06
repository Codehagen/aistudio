import { ImpersonationProvider } from "@/hooks/use-impersonation"
import { AdminHeader } from "@/components/admin/admin-header"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { Toaster } from "@/components/ui/sonner"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ImpersonationProvider>
      <div className="min-h-screen bg-background">
        <ImpersonationBanner />
        <AdminHeader />
        <main className="w-full py-6">{children}</main>
        <Toaster />
      </div>
    </ImpersonationProvider>
  )
}
