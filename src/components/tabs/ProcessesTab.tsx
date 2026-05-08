import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skull, ArrowUpDown } from "lucide-react";
import { api } from "@/lib/api";
import { barColor } from "@/lib/utils";
import { useAppStore } from "@/store/app";
import type { ProcessInfo } from "@/types";

type SortKey = "memory" | "cpu" | "name" | "pid";

export function ProcessesTab() {
  const queryClient = useQueryClient();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const [sortKey, setSortKey] = useState<SortKey>("memory");
  const [sortAsc, setSortAsc] = useState(false);
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set());

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ["processes"],
    queryFn: api.getProcesses,
  });

  const { data: sysInfo } = useQuery({
    queryKey: ["sysInfo"],
    queryFn: api.getSystemInfo,
  });

  const killMutation = useMutation({
    mutationFn: api.killProcess,
    onMutate: (pid) => setKillingPids((s) => new Set(s).add(pid)),
    onSettled: (_, __, pid) => {
      setKillingPids((s) => { const n = new Set(s); n.delete(pid); return n; });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const totalMem = sysInfo?.total_memory ?? 1;

  const sorted = [...processes]
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let diff = 0;
      if (sortKey === "memory") diff = b.memory_bytes - a.memory_bytes;
      else if (sortKey === "cpu") diff = b.cpu_usage - a.cpu_usage;
      else if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else if (sortKey === "pid") diff = a.pid - b.pid;
      return sortAsc ? -diff : diff;
    });

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest transition-colors ${
          active ? "text-brand-400" : "text-white/30 hover:text-white/50"
        }`}
      >
        {label}
        <ArrowUpDown size={9} />
      </button>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[28px_1fr_150px_80px_80px_80px] gap-0 px-4 py-2.5 border-b border-white/5 bg-white/2">
        <div />
        <SortBtn col="name"   label="Process" />
        <SortBtn col="memory" label="Memory"  />
        <SortBtn col="cpu"    label="CPU"     />
        <SortBtn col="pid"    label="PID"     />
        <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">Action</p>
      </div>

      {/* Rows */}
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        {isLoading ? (
          <div className="py-16 text-center text-white/25 text-sm">Loading processes…</div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center text-white/25 text-sm">No processes found</div>
        ) : (
          sorted.map((proc: ProcessInfo) => {
            const memPct = (proc.memory_bytes / totalMem) * 100;
            return (
              <div
                key={proc.pid}
                className="grid grid-cols-[28px_1fr_150px_80px_80px_80px] gap-0 items-center px-4 py-2 border-b border-white/5 hover:bg-white/3 transition-colors group"
              >
                <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5 text-[10px] text-white/40 font-mono">
                  {proc.name.charAt(0).toUpperCase()}
                </div>
                <div className="pl-3">
                  <p className="text-sm text-white/80 truncate max-w-[220px]">{proc.name}</p>
                  <p className="text-[10px] text-white/25">{proc.status}</p>
                </div>
                <div className="flex items-center gap-2 pr-2">
                  <div className="flex-1 h-0.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full ${barColor(memPct)}`} style={{ width: `${Math.min(100, memPct)}%` }} />
                  </div>
                  <span className="text-xs text-white/60 font-mono">{proc.memory_label}</span>
                </div>
                <span className="text-xs text-white/40 font-mono text-right pr-4">{proc.cpu_usage.toFixed(1)}%</span>
                <span className="text-[10px] text-white/30 font-mono">{proc.pid}</span>
                <button
                  onClick={() => killMutation.mutate(proc.pid)}
                  disabled={killingPids.has(proc.pid)}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-30"
                >
                  <Skull size={10} /> Kill
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-white/5 bg-white/2">
        <p className="text-[10px] text-white/25">{sorted.length} processes shown</p>
      </div>
    </div>
  );
}
