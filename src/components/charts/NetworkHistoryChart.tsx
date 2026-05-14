import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { Loader2, Globe } from "lucide-react";
import { fmtBytes } from "@/lib/utils";

export function NetworkHistoryChart() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["network-history"],
    queryFn: api.getNetworkHistory,
    refetchInterval: 3000,
  });

  if (isLoading || !history.length) {
    return (
      <div className="h-64 bg-white/[0.02] rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-white/10" size={24} />
        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Warming up network history...</span>
      </div>
    );
  }

  const chartData = history.map((p) => ({
    ...p,
    rx_speed_kb: p.rx_speed / 1024,
    tx_speed_kb: p.tx_speed / 1024,
    time: new Date(p.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }));

  return (
    <div className="bg-white/[0.03] rounded-3xl border border-white/10 p-6 space-y-4 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-white/50">
          <Globe size={14} className="text-sky-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">60s Network Activity</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Download</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Upload</span>
          </div>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis 
                tick={{fontSize: 9, fill: '#ffffff20', fontWeight: 'bold'}} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => `${(val/1024).toFixed(1)}M`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
              itemStyle={{ fontWeight: 'bold', fontSize: '10px' }}
              labelStyle={{ color: '#666', marginBottom: '4px' }}
              formatter={(val: number) => [fmtBytes(val * 1024) + "/s"]}
            />
            <Area 
                type="monotone" 
                dataKey="rx_speed" 
                name="Download"
                stroke="#38bdf8" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRx)" 
                isAnimationActive={false}
            />
            <Area 
                type="monotone" 
                dataKey="tx_speed" 
                name="Upload"
                stroke="#fbbf24" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTx)" 
                isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
