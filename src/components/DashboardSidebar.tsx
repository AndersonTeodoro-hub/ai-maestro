import { Home, MessageSquare, BookOpen, BarChart3, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, profile } = useAuth();
  const { t } = useTranslation();

  const items = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: Home },
    { title: t("nav.chat"), url: "/dashboard/chat", icon: MessageSquare },
    { title: t("nav.promptLibrary"), url: "/dashboard/prompts", icon: BookOpen },
    { title: t("nav.analytics"), url: "/dashboard/analytics", icon: BarChart3 },
    { title: t("nav.settings"), url: "/dashboard/settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-[hsl(var(--surface-1))]">
      <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <img src="/logo.svg" alt="SavvyOwl" className="h-8 w-8 shrink-0" />
        {!collapsed && <span className="text-lg font-bold text-sidebar-foreground text-tracking-tight">SavvyOwl</span>}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = item.url === "/dashboard"
                  ? location.pathname === "/dashboard"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={`relative rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                        activeClassName=""
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                        )}
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed && profile && (
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {(profile.full_name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground font-medium truncate">{profile.full_name || "User"}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 h-4">
                {(profile.plan || "free").charAt(0).toUpperCase() + (profile.plan || "free").slice(1)}
              </Badge>
            </div>
          </div>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "default"} className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/50" onClick={signOut}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">{t("nav.signOut")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
