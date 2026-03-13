import { SidebarV2 } from "@/components/layout/sidebar-v2";
import { TopHeader } from "@/components/layout/top-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { KeyboardShortcuts } from "@/components/features/keyboard-shortcuts";
import { OnboardingChecklist } from "@/components/features/onboarding-checklist";
import { Modals } from "@/components/modals";
import { GlobalSearch } from "@/components/features/global-search";
import { VisibilityRefetchProvider } from "@/components/layout/visibility-refetch-provider";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VisibilityRefetchProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TopHeader />
        <div className="flex flex-1 overflow-hidden">
          <SidebarV2 />
          <main className="flex-1 overflow-y-auto">
            <div className="h-full p-6"><Breadcrumbs />
            {children}</div>
          </main>
        </div>
      </div>
      {/* GlobalSearch mounted at layout level so ⌘K works on every page */}
      <GlobalSearch triggerless />
      <KeyboardShortcuts />
      <OnboardingChecklist />
      <Modals />
    </VisibilityRefetchProvider>
  );
}
