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

const starterPrompts = [
  { title: "Instagram Caption", category: "Social", content: "Write an Instagram caption for {product} targeting {audience}. Tone: {tone}. Include 5 relevant hashtags." },
  { title: "YouTube Script Outline", category: "Content", content: "Create a YouTube video script outline for the topic: {topic}. Duration: {duration} minutes. Style: {style}." },
  { title: "Tweet Variations", category: "Social", content: "Write 5 Tweet variations about {subject} that will drive engagement." },
  { title: "Email Subject Lines", category: "Email", content: "Create an email subject line for a campaign about {offer}. Write 10 variations, from curiosity to urgency." },
  { title: "TikTok Hook", category: "Social", content: "Write a TikTok hook (first 3 seconds) for a video about {topic}." },
  { title: "Content Repurposer", category: "Content", content: "Repurpose this content for 3 platforms (Instagram, LinkedIn, Twitter): {content}" },
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
    for (const sp of starterPrompts) {
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
          <h1 className="text-2xl font-bold text-foreground">{t("prompts.title")}</h1>
          <p className="text-muted-foreground">{t("prompts.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("prompts.newPrompt")}
        </Button>
      </div>

      {prompts && prompts.length === 0 && (
        <Card className="bg-card border-border/50">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("prompts.noPrompts")}</h3>
            <p className="text-muted-foreground mb-4">{t("prompts.noPromptsDesc")}</p>
            <Button onClick={loadStarters}>{t("prompts.loadStarters")}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prompts?.map((p) => (
          <Card key={p.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-foreground">{p.title}</h3>
                <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                  {t(`prompts.categories.${p.category}`, p.category)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4" dangerouslySetInnerHTML={{ __html: highlightVars(p.content) }} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("prompts.used")} {p.use_count}{t("prompts.times")}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>{t("common.edit")}</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>{t("common.delete")}</Button>
                  <Button size="sm" onClick={() => handleUse(p)}>
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editId ? t("prompts.editPrompt") : t("prompts.newPrompt")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder={t("prompts.promptTitle")} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-secondary border-border" />
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c}>{t(`prompts.categories.${c}`, c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea placeholder={t("prompts.promptContent")} value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="bg-secondary border-border" />
            <Button className="w-full" onClick={handleSave}>{t("prompts.savePrompt")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVars} onOpenChange={setShowVars}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("prompts.fillDetails")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedPrompt && extractVars(selectedPrompt.content).map((v) => (
              <div key={v}>
                <label className="text-sm text-muted-foreground capitalize mb-1 block">{v}</label>
                <Input value={varValues[v] || ""} onChange={(e) => setVarValues((prev) => ({ ...prev, [v]: e.target.value }))} className="bg-secondary border-border" placeholder={`Enter ${v}...`} />
              </div>
            ))}
            <Button className="w-full" onClick={handleFillAndGo}>
              <Play className="mr-2 h-4 w-4" />
              {t("prompts.useInChat")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
