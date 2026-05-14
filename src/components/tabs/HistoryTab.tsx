import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "@/lib/api";
import { Loader2, Calendar, TrendingUp, Cpu, MemoryStick, HardDrive, AlertCircle } from "lucide-react";
import { fmtBytes } from "@/lib/utils";

const RANGES = [
  { label: "1 Hour",   value: 1 },
  { label: "6 Hours",  value: 6 },
  { label: "24 Hours", value: 24 },
  { label: "7 Days",   value: 168 },
];

export function HistoryTab() {
  const [range, setRange] = useState(6); // Default 6h
  
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ["history-trends", range],
    queryFn: () => api.getHistoricalTrends(range),
    refetchInterval: 60000, // Refresh every minute
  });

  const chartData = history.map(p => ({
    ...p,
    time: new Date(p.ts * 1000).toLocaleTimeString([], { 
        month: range > 24 ? 'short' : undefined,
        day: range > 24 ? 'numeric' : undefined,
        hour: '2-digit', 
        minute: '2-digit' 
    }),
    ram_pct: (p.ram_used / p.ram_total) * 100,
    disk_pct: (p.disk_used / p.disk_total) * 100,
  }));

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-brand-500" size={32} />
        <p className="text-sm text-surface-400 animate-pulse">Retrieving historical trends...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-10">
        <AlertCircle size={40} className="text-red-500/50" />
        <div>
          <h3 className="text-lg font-bold text-surface-900 dark:text-white">Database Error</h3>
          <p className="text-sm text-surface-400 mt-1">Failed to read historical data from SQLite. Try clearing history in settings.</p>
        </div>
      </div>
    );
  }

  // Calculate peaks
  const peakCpu = Math.max(...history.map(p => p.cpu_pct), 0);
  const peakRam = Math.max(...history.map(p => (p.ram_used / p.ram_total) * 100), 0);
  const avgCpu = history.length ? history.reduce((acc, p) => acc + p.cpu_pct, 0) / history.length : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center text-brand-600">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">System History</h2>
            <p className="text-xs text-surface-400 mt-0.5">Visualize usage trends over time</p>
          </div>
        </div>

        <div className="flex bg-surface-100 dark:bg-white/5 p-1 rounded-xl border border-surface-200 dark:border-white/5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                range === r.value
                  ? "bg-white dark:bg-surface-800 text-brand-600 shadow-sm"
                  : "text-surface-400 hover:text-surface-900 dark:hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!history.length ? (
        <div className="bg-surface-50 dark:bg-white/[0.02] rounded-3xl border border-dashed border-surface-200 dark:border-white/10 p-20 flex flex-col items-center justify-center gap-4 text-center">
            <Calendar size={48} className="text-surface-200 dark:text-white/5" />
            <div>
                <p className="text-sm font-bold text-surface-400 uppercase tracking-widest">No data points yet</p>
                <p className="text-xs text-surface-400/60 mt-1 max-w-xs">Historical snapshots are recorded every minute. Please wait a few moments for the first data to appear.</p>
            </div>
        </div>
      ) : (
        <>
          {/* Main Chart */}
          <div className="bg-white dark:bg-white/[0.03] rounded-3xl border border-surface-200 dark:border-white/10 p-6 shadow-xl transition-colors">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-surface-400 dark:text-white/50">
                    <TrendingUp size={14} className="text-brand-500" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Usage Trends (%)</h3>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider">CPU</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider">RAM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-wider">Disk</span>
                    </div>
                </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-white/5" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    tick={{fontSize: 9, fill: 'currentColor', fontWeight: 'bold'}} 
                    className="text-surface-300 dark:text-white/20"
                    axisLine={false} 
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    tick={{fontSize: 9, fill: 'currentColor', fontWeight: 'bold'}} 
                    className="text-surface-300 dark:text-white/20"
                    domain={[0, 100]}
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-white/10 rounded-xl p-3 shadow-xl">
                                    <p className="text-[10px] text-surface-400 dark:text-white/30 mb-2">{label}</p>
                                    {payload.map((entry: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between gap-8 py-1 first:pt-0 border-b border-surface-200 dark:border-white/5 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                <span className="text-[10px] font-bold text-surface-400 dark:text-white/50">{entry.name}</span>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-surface-900 dark:text-white">
                                                {entry.value.toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        return null;
                    }}
                  />
                  <Area type="monotone" dataKey="cpu_pct" name="CPU" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="ram_pct" name="RAM" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="disk_pct" name="Disk" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorDisk)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard 
                icon={<Cpu size={14} />} 
                label="Peak CPU" 
                value={`${peakCpu.toFixed(1)}%`} 
                subValue={`Avg: ${avgCpu.toFixed(1)}%`} 
                color="text-brand-500" 
            />
            <StatCard 
                icon={<MemoryStick size={14} />} 
                label="Peak RAM" 
                value={`${peakRam.toFixed(1)}%`} 
                subValue="Last recording" 
                color="text-emerald-500" 
            />
             <StatCard 
                icon={<HardDrive size={14} />} 
                label="Storage Load" 
                value={fmtBytes(history[history.length-1]?.disk_used ?? 0)} 
                subValue={`${((history[history.length-1]?.disk_used / history[history.length-1]?.disk_total) * 100).toFixed(1)}% used`} 
                color="text-amber-500" 
            />
            <StatCard 
                icon={<Calendar size={14} />} 
                label="Data Points" 
                value={history.length.toString()} 
                subValue={`Range: ${range}h`} 
                color="text-sky-500" 
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: { icon: any, label: string, value: string, subValue: string, color: string }) {
    return (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-surface-200 dark:border-white/5 p-4 transition-colors">
            <div className="flex items-center gap-2 text-surface-400 dark:text-white/30 mb-2">
                <div className={`${color}/10 ${color} p-1.5 rounded-lg`}>
                    {icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-xl font-bold text-surface-900 dark:text-white">{value}</div>
            <div className="text-[10px] text-surface-400 dark:text-white/20 mt-1">{subValue}</div>
        </div>
    );
}
