import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Euro, Activity, TrendingDown, BarChart3 } from "lucide-react";

const PIE_COLORS = ["hsl(217 91% 60%)", "hsl(160 84% 39%)", "hsl(280 70% 60%)"];

export default function Analytics() {
  const { user } = useAuth();
  const [range, setRange] = useState("month");

  const getStartDate = () => {
    const d = new Date();
    if (range === "week") d.setDate(d.getDate() - 7);
    else if (range === "month") d.setMonth(d.getMonth() - 1);
    else d.setMonth(d.getMonth() - 3);
    return d.toISOString();
  };

  const { data } = useQuery({
    queryKey: ["analytics", user?.id, range],
    enabled: !!user,
    queryFn: async () => {
      const { data: logs } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("user_id", user!.id)
        .gte("created_at", getStartDate())
        .order("created_at", { ascending: true });

      const items = logs || [];
      const totalSpend = items.reduce((s, l) => s + (l.cost_eur || 0), 0);
      const totalRequests = items.length;
      const moneySaved = totalSpend * 0.4;

      // Daily spend
      const dailyMap: Record<string, number> = {};
      items.forEach((l) => {
        const day = new Date(l.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        dailyMap[day] = (dailyMap[day] || 0) + (l.cost_eur || 0);
      });
      const dailySpend = Object.entries(dailyMap).map(([date, spend]) => ({ date, spend: +spend.toFixed(4) }));

      // Mode distribution
      const modeMap: Record<string, number> = { quick: 0, deep: 0, creator: 0 };
      items.forEach((l) => { modeMap[l.mode] = (modeMap[l.mode] || 0) + 1; });
      const modeData = Object.entries(modeMap)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({
          name: name === "quick" ? "Quick ⚡" : name === "deep" ? "Deep Think 🧠" : "ContentCreator ✍️",
          value,
        }));

      // Recent requests
      const recent = items.slice(-20).reverse().map((l) => ({
        date: new Date(l.created_at).toLocaleDateString(),
        mode: l.mode,
        model: l.model?.split("/").pop() || "—",
        cost: `€${(l.cost_eur || 0).toFixed(4)}`,
      }));

      return { totalSpend, totalRequests, moneySaved, dailySpend, modeData, recent };
    },
  });

  const stats = [
    { title: "Total Spend", value: `€${(data?.totalSpend || 0).toFixed(2)}`, icon: Euro },
    { title: "Requests", value: data?.totalRequests || 0, icon: Activity },
    { title: "Money Saved", value: `€${(data?.moneySaved || 0).toFixed(2)}`, icon: TrendingDown },
    { title: "Avg per Request", value: `€${data?.totalRequests ? ((data.totalSpend || 0) / data.totalRequests).toFixed(4) : "0.00"}`, icon: BarChart3 },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="quarter">Last 3 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Spend Chart */}
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-lg">Daily Spend</CardTitle></CardHeader>
          <CardContent>
            {data?.dailySpend && data.dailySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailySpend}>
                  <XAxis dataKey="date" stroke="hsl(215 20% 65%)" fontSize={12} />
                  <YAxis stroke="hsl(215 20% 65%)" fontSize={12} tickFormatter={(v) => `€${v}`} />
                  <Tooltip contentStyle={{ background: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 96%)" }} />
                  <Bar dataKey="spend" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Mode Distribution */}
        <Card className="bg-card border-border/50">
          <CardHeader><CardTitle className="text-lg">Usage by Mode</CardTitle></CardHeader>
          <CardContent>
            {data?.modeData && data.modeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={data.modeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {data.modeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(217 33% 17%)", border: "1px solid hsl(217 33% 25%)", borderRadius: "8px", color: "hsl(210 40% 96%)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request History */}
      <Card className="bg-card border-border/50">
        <CardHeader><CardTitle className="text-lg">Recent Requests</CardTitle></CardHeader>
        <CardContent>
          {data?.recent && data.recent.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="capitalize">{r.mode}</TableCell>
                    <TableCell className="text-muted-foreground">{r.model}</TableCell>
                    <TableCell className="text-right">{r.cost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No requests yet. Start chatting to see analytics!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
