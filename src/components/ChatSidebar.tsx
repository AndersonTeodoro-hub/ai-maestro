import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Trash2,
  FolderOpen,
  FolderPlus,
  ArrowRightLeft,
  Share2,
  MoreHorizontal,
  PanelLeftClose,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  project_id: string | null;
};

type Project = {
  id: string;
  name: string;
  created_at: string;
};

type ChatSidebarProps = {
  conversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function ChatSidebar({
  conversationId,
  onSelectConversation,
  onNewChat,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}: ChatSidebarProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  const navItems = [
    { title: t("nav.dashboard"), url: "/dashboard/home", icon: Home },
    { title: t("nav.chat"), url: "/dashboard/chat", icon: MessageSquare },
    { title: t("nav.promptLibrary"), url: "/dashboard/prompts", icon: BookOpen },
    { title: t("nav.analytics"), url: "/dashboard/analytics", icon: BarChart3 },
    { title: "Characters", url: "/dashboard/characters", icon: Users },
    { title: t("nav.settings"), url: "/dashboard/settings", icon: Settings },
  ];

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, mode, created_at, project_id")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      return (data || []) as Conversation[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, created_at")
        .eq("user_id", user!.id)
        .order("name", { ascending: true });
      return (data || []) as Project[];
    },
  });

  const filteredConversations = conversations?.filter((c) => {
    if (!selectedProjectFilter) return true;
    if (selectedProjectFilter === "__none__") return !c.project_id;
    return c.project_id === selectedProjectFilter;
  });

  const groupConversations = (convs: Conversation[] | undefined) => {
    if (!convs) return {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

    const groups: Record<string, Conversation[]> = {};
    for (const c of convs) {
      const d = new Date(c.created_at);
      let key: string;
      if (d >= todayStart) key = t("chat.today");
      else if (d >= yesterdayStart) key = t("chat.yesterday");
      else if (d >= weekStart) key = t("chat.lastWeek");
      else key = t("chat.older");

      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  };

  const grouped = groupConversations(filteredConversations);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("messages").delete().eq("conversation_id", deleteTarget);
    await supabase.from("conversations").delete().eq("id", deleteTarget);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    if (conversationId === deleteTarget) onNewChat();
    setDeleteTarget(null);
    toast.success(t("chat.conversationDeleted"));
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !user) return;
    await supabase.from("projects").insert({ user_id: user.id, name: newProjectName.trim() });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    setNewProjectName("");
    setNewProjectOpen(false);
    toast.success(t("chat.projectCreated"));
  };

  const handleMoveToProject = async (conversationId: string, projectId: string | null) => {
    await supabase
      .from("conversations")
      .update({ project_id: projectId })
      .eq("id", conversationId);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    toast.success(t("chat.conversationMoved"));
  };

  const handleNav = (url: string) => {
    navigate(url);
    onCloseMobile?.();
  };

  return (
    <div className="h-full flex flex-col bg-sidebar-background border-r border-sidebar-border overflow-hidden">
      {/* Logo + Toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border shrink-0">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="SavvyOwl" className="h-7 w-7 shrink-0" />
              <span className="text-lg font-bold text-foreground tracking-tight">SavvyOwl</span>
            </div>
            {onToggleCollapse && (
              <button onClick={onToggleCollapse} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex justify-center">
            {onToggleCollapse ? (
              <button onClick={onToggleCollapse} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <PanelLeftClose className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <img src="/logo.svg" alt="SavvyOwl" className="h-7 w-7" />
            )}
          </div>
        )}
      </div>

      {/* New Chat */}
      <div className="p-3 shrink-0">
        <Button
          onClick={() => { onNewChat(); onCloseMobile?.(); }}
          className={`w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 overflow-hidden ${collapsed ? "px-0 justify-center" : "text-xs"}`}
          size="sm"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{t("chat.newChat")}</span>}
        </Button>
      </div>

      {/* Nav Links */}
      <nav className="px-2 pb-2 space-y-0.5 shrink-0">
        {navItems.map((item) => {
          const isActive =
            item.url === "/dashboard/home"
              ? location.pathname === "/dashboard/home"
              : location.pathname.startsWith(item.url);
          return (
            <button
              key={item.url}
              onClick={() => handleNav(item.url)}
              className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2"} px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </button>
          );
        })}
      </nav>

      {/* Separator */}
      <div className={`border-t border-sidebar-border mx-3 ${collapsed ? "hidden" : ""}`} />

      {/* Projects filter */}
      <div className={`px-3 py-2 flex items-center gap-1 shrink-0 ${collapsed ? "hidden" : ""}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-xs text-muted-foreground h-8">
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              {selectedProjectFilter
                ? selectedProjectFilter === "__none__"
                  ? t("chat.noProject")
                  : projects?.find((p) => p.id === selectedProjectFilter)?.name
                : t("chat.allConversations")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => setSelectedProjectFilter(null)}>
              {t("chat.allConversations")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedProjectFilter("__none__")}>
              {t("chat.noProject")}
            </DropdownMenuItem>
            {projects?.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectFilter(p.id)}>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setNewProjectOpen(true)}
          title={t("chat.newProject")}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Conversation history */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? "hidden" : ""}`} style={{ minHeight: 0 }}>
        <div className="px-2 pb-2">
          {Object.entries(grouped).map(([label, convs]) => (
            <div key={label} className="mb-3">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground/60 px-2 mb-1 tracking-wider">
                {label}
              </p>
              {convs.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center w-full rounded-lg cursor-pointer transition-all duration-150 h-8 ${
                    conversationId === c.id
                      ? "bg-primary/10"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <div
                    className="flex items-center min-w-0 flex-1 overflow-hidden px-2 h-full"
                    onClick={() => { onSelectConversation(c.id); onCloseMobile?.(); }}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground mr-2" />
                    <span className={`block truncate text-xs ${
                      conversationId === c.id ? "text-primary font-medium" : "text-muted-foreground"
                    }`}>
                      {c.title}
                    </span>
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
                      {projects && projects.length > 0 && (
                        <>
                          <DropdownMenuItem
                            className="text-xs text-muted-foreground"
                            disabled
                          >
                            {t("chat.moveToProject")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToProject(c.id, null); }}>
                            {t("chat.noProject")}
                          </DropdownMenuItem>
                          {projects.map((p) => (
                            <DropdownMenuItem key={p.id} onClick={(e) => { e.stopPropagation(); handleMoveToProject(c.id, p.id); }}>
                              {p.name}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setTimeout(() => setDeleteTarget(c.id), 100); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {t("chat.deleteConversation")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ))}
          {(!filteredConversations || filteredConversations.length === 0) && (
            <p className="text-xs text-muted-foreground/50 px-2 py-4 text-center">{t("common.noDataYet")}</p>
          )}
        </div>
      </div>

      {/* Spacer when collapsed */}
      {collapsed && <div className="flex-1" />}

      {/* User footer */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        {!collapsed && profile && (
          <div className="flex items-center gap-2 px-1 mb-2">
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
        {collapsed && profile && (
          <div className="flex justify-center mb-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              {(profile.full_name || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={`w-full text-primary hover:text-primary hover:bg-primary/10 ${collapsed ? "justify-center px-0" : "justify-start"}`}
          onClick={async () => {
            const shareData = {
              title: "SavvyOwl",
              text: t("share.text"),
              url: "https://savvyowl.app",
            };
            if (navigator.share) {
              try { await navigator.share(shareData); } catch {}
            } else {
              await navigator.clipboard.writeText("https://savvyowl.app");
              toast.success(t("share.copied"));
            }
          }}
          title={collapsed ? t("share.button") : undefined}
        >
          <Share2 className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">{t("share.button")}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`w-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 ${collapsed ? "justify-center px-0" : "justify-start"}`}
          onClick={signOut}
          title={collapsed ? t("nav.signOut") : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">{t("nav.signOut")}</span>}
        </Button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chat.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chat.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Project dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.newProject")}</DialogTitle>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder={t("chat.projectName")}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreateProject}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
