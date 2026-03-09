import { Home, MessageSquare, BookOpen, BarChart3, Settings, Zap, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="h-16 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <Zap className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && <span className="text-lg font-bold text-sidebar-foreground">PromptOS</span>}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && profile && (
          <div className="text-xs text-muted-foreground mb-2 truncate px-2">
            {profile.full_name || "User"}
          </div>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "default"} className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">{t("nav.signOut")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
