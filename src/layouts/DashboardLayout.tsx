import { Outlet, Navigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export default function DashboardLayout() {
  const { user, loading, profile } = useAuth();
  const location = useLocation();
  const isChatRoute = location.pathname === "/dashboard/chat";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex gap-1">
          <div className="h-3 w-3 rounded-full bg-primary thinking-dot" />
          <div className="h-3 w-3 rounded-full bg-primary thinking-dot" />
          <div className="h-3 w-3 rounded-full bg-primary thinking-dot" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Chat route: full-screen layout managed by Chat page itself
  if (isChatRoute) {
    return (
      <div className="h-screen w-screen flex flex-col">
        <Outlet />
        {profile && !profile.onboarding_completed && <OnboardingModal />}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-[hsl(var(--surface-1))]/50 backdrop-blur-sm">
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground hidden md:flex" />
            <div className="md:hidden" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav />
      {profile && !profile.onboarding_completed && <OnboardingModal />}
    </SidebarProvider>
  );
}
