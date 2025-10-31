// src/pages/dashboard.tsx
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Package, Cpu, Archive, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/* API base detection (same as rest of app) */
const rawBase = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const API_BASE_URL = rawBase.endsWith("/") ? `${rawBase}api` : `${rawBase}/api`;

type TopProduct = { product_name: string; total_sales: number };
type MetricsResponse = {
  total_products: number;
  total_machines: number;
  total_stock_quantity: number;
  total_stock_value: number;
  top_selling_products?: TopProduct[];
};

async function req<T>(path: string) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Status ${res.status}`);
  }
  return (await res.json()) as T;
}

const COLORS = ["#15a5e8", "#6f42c1", "#00c2a8", "#ffb020", "#ef4444", "#a3e635"];

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<Array<{ date: string; revenue: number }>>([]);
  const [machineDist, setMachineDist] = useState<
    Array<{ machine_id: number; machine_name: string; total_qty: number; total_value: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [machineMetric, setMachineMetric] = useState<"qty" | "value">("qty");
  const { toast } = useToast();

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      // metrics (prefer /metrics else fallback)
      try {
        const m = await req<MetricsResponse>("/metrics");
        setMetrics(m);
      } catch {
        const fb = await req<any>("/dashboard-metrics");
        setMetrics({
          total_products: fb.totalProducts ?? fb.total_products ?? 0,
          total_machines: fb.activeMachines ?? fb.total_machines ?? 0,
          total_stock_quantity: fb.itemsInStock ?? fb.total_stock_quantity ?? 0,
          total_stock_value: Number(fb.stockValue ?? fb.total_stock_value ?? 0) || 0,
          top_selling_products: fb.top_selling_products ?? [],
        });
      }

      // revenue trend
      try {
        const rt = await req<Array<{ date: string; revenue: number }>>("/revenue-trend");
        setRevenueTrend(rt.map((r) => ({ date: String(r.date), revenue: Number(r.revenue || 0) })));
      } catch {
        setRevenueTrend([]);
      }

      // machine distribution
      try {
        const md = await req<Array<any>>("/machine-distribution");
        setMachineDist(
          (md || []).map((r: any) => ({
            machine_id: Number(r.machine_id),
            machine_name: r.machine_name || `M ${r.machine_id}`,
            total_qty: Number(r.total_qty || 0),
            total_value: Number(r.total_value || 0),
          }))
        );
      } catch (err) {
        console.warn("machine distribution failed", err);
        setMachineDist([]);
      }
    } catch (err: any) {
      console.error("Dashboard load error", err);
      toast({
        title: "Error",
        description: "Failed to load dashboard metrics. Make sure backend is running and VITE_API_BASE is correct.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  // Basic chart data
  const countsData = [
    { name: "Products", value: metrics?.total_products ?? 0 },
    { name: "Active Machines", value: metrics?.total_machines ?? 0 },
    { name: "Items in Stock", value: metrics?.total_stock_quantity ?? 0 },
  ];
  const stockValueData = [{ name: "Stock Value", value: Number(metrics?.total_stock_value ?? 0) }];

  const topProducts = metrics?.top_selling_products ?? [];
  const topPieData = topProducts.length ? topProducts.map((p) => ({ name: p.product_name, value: p.total_sales || 0 })) : [];

  // Machine chart data sorted by qty desc
  const machineChartData = [...machineDist].sort((a, b) => b.total_qty - a.total_qty).map((m) => ({
    name: m.machine_name,
    qty: m.total_qty,
    value: m.total_value,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your vending operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Products" value={metrics?.total_products ?? 0} icon={Package} />
        <MetricCard title="Active Machines" value={metrics?.total_machines ?? 0} icon={Cpu} />
        <MetricCard title="Items in Stock" value={metrics?.total_stock_quantity ?? 0} icon={Archive} />
        <MetricCard
          title="Stock Value"
          value={`$${Number(metrics?.total_stock_value ?? 0).toLocaleString()}`}
          icon={DollarSign}
        />
      </div>

      {/* Two-column area: left (main charts) wider, right (pies + machine) narrower */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column spans 2 / 3 on md */}
        <div className="md:col-span-2 space-y-6">
          {/* Quick metrics - make chart shorter and barSize small */}
          <Card className="glass p-4">
            <h2 className="text-lg font-semibold mb-1">Quick Metrics</h2>
            <p className="text-sm text-muted-foreground mb-3">Counts — compact overview</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countsData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Stock value - compact horizontal bar */}
          <Card className="glass p-4">
            <h2 className="text-lg font-semibold mb-1">Stock Value (currency)</h2>
            <p className="text-sm text-muted-foreground mb-3">Total value of items in stock</p>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockValueData} margin={{ top: 4, right: 8, left: 8, bottom: 8 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue line chart */}
          <Card className="glass p-4">
            <h2 className="text-lg font-semibold mb-1">Revenue (last 7 days)</h2>
            <p className="text-sm text-muted-foreground mb-3">Daily revenue for the last week</p>
            <div style={{ height: 240 }}>
              {revenueTrend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                    <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-36 text-muted-foreground">No revenue data available</div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: pies + machine distribution (narrower) */}
        <div className="space-y-6">
          <Card className="glass p-4">
            <h3 className="text-lg font-semibold mb-1">Top Selling Products</h3>
            <p className="text-sm text-muted-foreground mb-3">Share of top items</p>
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              {topPieData.length ? (
                <>
                  <div style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={64}
                          paddingAngle={6}
                          label={false}
                          isAnimationActive={false}
                        >
                          {topPieData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, name: any) => [`${v}`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* custom legend (safe for TypeScript) */}
                  <div style={{ width: "100%", marginTop: 8 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, fontSize: 12, marginTop: 6 }}>
                      {topPieData.map((d, i) => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 12, height: 12, background: COLORS[i % COLORS.length], borderRadius: 3, display: "inline-block" }} />
                          <span style={{ color: "var(--muted-foreground)" }}>{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-44 text-muted-foreground">No sales data available</div>
              )}
            </div>
          </Card>

          <Card className="glass p-4">
            <h3 className="text-lg font-semibold mb-1">Stock Distribution (by machine)</h3>
            <p className="text-sm text-muted-foreground mb-3">Toggle metric to compare machines</p>

            <div className="flex items-center gap-2 mb-3">
              <Button variant={machineMetric === "qty" ? "default" : "ghost"} size="sm" onClick={() => setMachineMetric("qty")}>
                Quantity
              </Button>
              <Button variant={machineMetric === "value" ? "default" : "ghost"} size="sm" onClick={() => setMachineMetric("value")}>
                Value
              </Button>
            </div>

            <div style={{ height: 260 }}>
              {machineChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={machineChartData}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v) => (machineMetric === "value" ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString())}
                    />
                    <YAxis type="category" dataKey="name" width={160} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: any) => (machineMetric === "value" ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString())} />
                    <Bar
                      dataKey={machineMetric === "qty" ? "qty" : "value"}
                      name={machineMetric === "qty" ? "Quantity" : "Value"}
                      fill="hsl(var(--primary))"
                      radius={[6, 6, 6, 6]}
                      barSize={14} // thinner bars
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">No machine distribution data</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
