import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function DashboardLayout() {
  const { user, loading, profile } = useAuth();

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/50 backdrop-blur-sm">
            <SidebarTrigger className="mr-4" />
            <LanguageSelector />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      {profile && !profile.onboarding_completed && <OnboardingModal />}
    </SidebarProvider>
  );
}
