import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, TrendingDown, Activity, Euro } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardHome() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: logs } = await supabase
        .from("usage_logs")
        .select("cost_eur, tokens_input, tokens_output")
        .eq("user_id", user!.id)
        .gte("created_at", startOfMonth.toISOString());

      const totalSpend = logs?.reduce((s, l) => s + (l.cost_eur || 0), 0) || 0;
      const totalRequests = logs?.length || 0;
      const tokensSaved = logs?.reduce((s, l) => s + (l.tokens_input + l.tokens_output) * 0.15, 0) || 0;
      const moneySaved = totalSpend * 0.4;

      return { totalSpend, totalRequests, tokensSaved: Math.round(tokensSaved), moneySaved };
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title, mode, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const statCards = [
    {
      title: "This month's spend",
      value: `€${(stats?.totalSpend || 0).toFixed(2)}`,
      icon: Euro,
    },
    {
      title: "Requests made",
      value: stats?.totalRequests || 0,
      icon: Activity,
    },
    {
      title: "Optimisation savings",
      value: `€${(stats?.moneySaved || 0).toFixed(2)}`,
      icon: TrendingDown,
    },
    {
      title: "Money saved vs ChatGPT",
      value: `€${(stats?.moneySaved || 0).toFixed(2)}`,
      icon: TrendingDown,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {getGreeting()}, {profile?.full_name || "there"} 👋
            </h1>
            <p className="text-muted-foreground mt-1">Here's your AI activity overview.</p>
          </div>
          <Button onClick={() => navigate("/dashboard/chat")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.title} className="bg-card border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <s.icon className="h-4 w-4" />
                {s.title}
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors"
                  onClick={() => navigate(`/dashboard/chat?id=${conv.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{conv.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{conv.mode} mode</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conv.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No activity yet. Start your first chat!</p>
              <Button onClick={() => navigate("/dashboard/chat")}>Start Chatting</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
