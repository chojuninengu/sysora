import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Globe, Download, Upload, Server, Activity, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { fmtBytes } from "@/lib/utils";
import { StatCard } from "@/components/layout/StatCard";
import { NetworkHistoryChart } from "@/components/charts/NetworkHistoryChart";

export function NetworkTab() {
  const queryClient = useQueryClient();

  const { data: interfaces = [], isLoading } = useQuery({
    queryKey: ["network-stats"],
    queryFn: api.getNetworkStats,
  });

  const { data: snapshot } = useQuery({
    queryKey: ["tray-snapshot"],
    queryFn: api.getTraySnapshot,
  });

  // Listen for background updates
  useEffect(() => {
    const unlisten = listen("network-update", () => {
      queryClient.invalidateQueries({ queryKey: ["network-stats"] });
      queryClient.invalidateQueries({ queryKey: ["network-history"] });
      queryClient.invalidateQueries({ queryKey: ["tray-snapshot"] });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

  const totalRxSpeed = snapshot?.network?.[0] ?? 0;
  const totalTxSpeed = snapshot?.network?.[1] ?? 0;
  
  // Calculate today's totals from interfaces
  const totalRxToday = interfaces.reduce((a, b) => a + b.total_rx, 0);
  const totalTxToday = interfaces.reduce((a, b) => a + b.total_tx, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-5xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Download Speed"
          value={`${fmtBytes(totalRxSpeed)}/s`}
          sub="Live aggregate"
          pct={Math.min(100, (totalRxSpeed / (100 * 1024 * 1024)) * 100)} // Normalized to 100MB/s for visual
          icon={<Download size={14} />}
          colorFuncs={{ bar: () => "bg-sky-400", text: () => "text-sky-400" }}
        />
        <StatCard
          label="Upload Speed"
          value={`${fmtBytes(totalTxSpeed)}/s`}
          sub="Live aggregate"
          pct={Math.min(100, (totalTxSpeed / (20 * 1024 * 1024)) * 100)} // Normalized to 20MB/s for visual
          icon={<Upload size={14} />}
          colorFuncs={{ bar: () => "bg-amber-400", text: () => "text-amber-400" }}
        />
        <StatCard
          label="Total Downloaded"
          value={fmtBytes(totalRxToday)}
          sub="Since last boot"
          pct={100}
          icon={<ArrowDownCircle size={14} />}
          colorFuncs={{ bar: () => "bg-white/10", text: () => "text-white/40" }}
        />
        <StatCard
          label="Total Uploaded"
          value={fmtBytes(totalTxToday)}
          sub="Since last boot"
          pct={100}
          icon={<ArrowUpCircle size={14} />}
          colorFuncs={{ bar: () => "bg-white/10", text: () => "text-white/40" }}
        />
      </div>

      {/* History Chart */}
      <NetworkHistoryChart />

      {/* Interfaces Table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white/50 px-1">
          <Server size={14} className="text-brand-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Network Interfaces</h3>
        </div>

        <div className="card overflow-hidden shadow-xl">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Interface</span>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">IP Address</span>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Download</span>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Upload</span>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest text-right">Total Data</span>
          </div>

          <div className="divide-y divide-white/5">
            {isLoading ? (
               <div className="p-12 text-center text-white/10 flex flex-col items-center gap-2">
                 <Activity size={24} className="animate-pulse" />
                 <p className="text-xs">Analyzing network hardware...</p>
               </div>
            ) : interfaces.map((iface, i) => (
              <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-brand-500/10 group-hover:text-brand-400 transition-all shrink-0">
                    <Globe size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white/90 truncate">{iface.name}</p>
                    <p className="text-[10px] text-white/20 font-mono truncate">{iface.mac_address || "No MAC"}</p>
                  </div>
                </div>

                <div className="overflow-hidden">
                   <p className="text-[11px] font-mono text-white/60 truncate">{iface.ip_address || "Disconnected"}</p>
                </div>

                <div>
                   <p className="text-[11px] font-mono font-bold text-sky-400/80">{fmtBytes(iface.rx_speed)}/s</p>
                </div>

                <div>
                   <p className="text-[11px] font-mono font-bold text-amber-400/80">{fmtBytes(iface.tx_speed)}/s</p>
                </div>

                <div className="text-right">
                   <p className="text-[11px] font-mono text-white/40">RX: {fmtBytes(iface.total_rx)}</p>
                   <p className="text-[11px] font-mono text-white/40">TX: {fmtBytes(iface.total_tx)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
