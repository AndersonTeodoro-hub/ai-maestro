import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const categories = ["Content", "Marketing", "Email", "Social", "Other"];

const getStarterPrompts = (t: (key: string) => string) => [
  {
    title: t("prompts.starters.caption_title"),
    category: "Social",
    content: t("prompts.starters.caption_content"),
  },
  {
    title: t("prompts.starters.reels_title"),
    category: "Social",
    content: t("prompts.starters.reels_content"),
  },
  {
    title: t("prompts.starters.calendar_title"),
    category: "Content",
    content: t("prompts.starters.calendar_content"),
  },
  {
    title: t("prompts.starters.ugc_title"),
    category: "Content",
    content: t("prompts.starters.ugc_content"),
  },
  {
    title: t("prompts.starters.stories_title"),
    category: "Social",
    content: t("prompts.starters.stories_content"),
  },
  {
    title: t("prompts.starters.ideas_title"),
    category: "Content",
    content: t("prompts.starters.ideas_content"),
  },
];

export default function Prompts() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Content");
  const [editContent, setEditContent] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const { data: prompts } = useQuery({
    queryKey: ["prompts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("prompts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const extractVars = (text: string) => {
    const matches = text.match(/\{(\w+)\}/g);
    return matches ? [...new Set(matches.map((m) => m.slice(1, -1)))] : [];
  };

  const handleSave = async () => {
    if (!editTitle || !editContent) { toast.error(t("prompts.titleRequired")); return; }
    if (profile?.plan === "free" && !editId && (prompts?.length || 0) >= 3) { toast.error(t("prompts.freeLimitPrompts")); return; }

    if (editId) {
      await supabase.from("prompts").update({ title: editTitle, category: editCategory, content: editContent }).eq("id", editId);
    } else {
      await supabase.from("prompts").insert({ user_id: user!.id, title: editTitle, category: editCategory, content: editContent });
    }
    queryClient.invalidateQueries({ queryKey: ["prompts"] });
    setShowCreate(false);
    resetForm();
    toast.success(t("prompts.promptSaved"));
  };

  const handleUse = (prompt: any) => {
    const vars = extractVars(prompt.content);
    if (vars.length > 0) { setSelectedPrompt(prompt); setVarValues({}); setShowVars(true); }
    else {
      supabase.from("prompts").update({ use_count: (prompt.use_count || 0) + 1 }).eq("id", prompt.id).then(() => {});
      navigate(`/dashboard/chat?prompt=${encodeURIComponent(prompt.content)}`);
    }
  };

  const handleFillAndGo = () => {
    if (!selectedPrompt) return;
    let filled = selectedPrompt.content;
    for (const [key, value] of Object.entries(varValues)) {
      filled = filled.replaceAll(`{${key}}`, value || `{${key}}`);
    }
    supabase.from("prompts").update({ use_count: (selectedPrompt.use_count || 0) + 1 }).eq("id", selectedPrompt.id).then(() => {});
    setShowVars(false);
    navigate(`/dashboard/chat?prompt=${encodeURIComponent(filled)}`);
  };

  const loadStarters = async () => {
    const starters = getStarterPrompts(t);
    for (const sp of starters) {
      await supabase.from("prompts").insert({ user_id: user!.id, ...sp, is_starter: true });
    }
    queryClient.invalidateQueries({ queryKey: ["prompts"] });
    toast.success(t("prompts.startersLoaded"));
  };

  const resetForm = () => { setEditTitle(""); setEditCategory("Content"); setEditContent(""); setEditId(null); };

  const openEdit = (p: any) => { setEditId(p.id); setEditTitle(p.title); setEditCategory(p.category); setEditContent(p.content); setShowCreate(true); };

  const handleDelete = async (id: string) => {
    await supabase.from("prompts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["prompts"] });
    toast.success(t("prompts.promptDeleted"));
  };

  const highlightVars = (text: string) =>
    text.replace(/\{(\w+)\}/g, '<span class="text-primary font-medium">{$1}</span>');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-tracking-tight">{t("prompts.title")}</h1>
          <p className="text-muted-foreground">{t("prompts.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} className="glow-primary">
          <Plus className="mr-2 h-4 w-4" />
          {t("prompts.newPrompt")}
        </Button>
      </div>

      {prompts && prompts.length === 0 && (
        <Card className="bg-[hsl(var(--surface-2))] border-border">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("prompts.noPrompts")}</h3>
            <p className="text-muted-foreground mb-4">{t("prompts.noPromptsDesc")}</p>
            <Button onClick={loadStarters} className="glow-primary">{t("prompts.loadStarters")}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts?.map((p) => (
          <Card key={p.id} className="bg-[hsl(var(--surface-2))] border-border hover:border-primary/50 transition-all duration-200 group hover:glow-primary">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-foreground text-tracking-tight">{p.title}</h3>
                <Badge variant="secondary" className="text-[10px] shrink-0 ml-2 uppercase text-tracking-wide">
                  {t(`prompts.categories.${p.category}`, p.category)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4" dangerouslySetInnerHTML={{ __html: highlightVars(p.content) }} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("prompts.used")} {p.use_count}{t("prompts.times")}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(p)}>{t("common.edit")}</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>{t("common.delete")}</Button>
                  <Button size="sm" onClick={() => handleUse(p)} className="glow-primary">
                    <Play className="mr-1 h-3 w-3" />
                    {t("prompts.use")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[hsl(var(--surface-2))] border-border shadow-elevated">
          <DialogHeader>
            <DialogTitle className="text-tracking-tight">{editId ? t("prompts.editPrompt") : t("prompts.newPrompt")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={t("prompts.promptTitle")} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary" />
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="bg-[hsl(var(--surface-1))] border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{t(`prompts.categories.${c}`, c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea placeholder={t("prompts.promptContent")} value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary" />
            <Button className="w-full glow-primary" onClick={handleSave}>{t("prompts.savePrompt")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVars} onOpenChange={setShowVars}>
        <DialogContent className="bg-[hsl(var(--surface-2))] border-border shadow-elevated">
          <DialogHeader>
            <DialogTitle className="text-tracking-tight">{t("prompts.fillDetails")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedPrompt && extractVars(selectedPrompt.content).map((v) => (
              <div key={v}>
                <label className="text-sm text-muted-foreground capitalize mb-1 block">{v}</label>
                <Input value={varValues[v] || ""} onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))} className="bg-[hsl(var(--surface-1))] border-border focus-visible:border-primary" placeholder={`Enter ${v}...`} />
              </div>
            ))}
            <Button className="w-full glow-primary" onClick={handleFillAndGo}>
              <Play className="mr-2 h-4 w-4" />
              {t("prompts.useInChat")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
