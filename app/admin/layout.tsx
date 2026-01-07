import { AdminHeader } from "@/components/admin/admin-header";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { Toaster } from "@/components/ui/sonner";
import { requireSystemAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify system admin access - redirects if not authorized
  await requireSystemAdmin();

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <AdminHeader />
      <main className="w-full py-6">{children}</main>
      <Toaster />
    </div>
  );
}
