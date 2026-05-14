import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { Cpu, MemoryStick, HardDrive, Battery, Skull } from "lucide-react";
import { api } from "@/lib/api";
import { fmtBytes, barColor, healthColor, healthPctColor } from "@/lib/utils";
import { StatCard } from "@/components/layout/StatCard";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { useAppStore } from "@/store/app";

function ProcessRow({
  proc,
  totalMem,
  onKill,
  killing,
}: {
  proc: import("@/types").ProcessInfo;
  totalMem: number;
  onKill: (pid: number) => void;
  killing: boolean;
}) {
  const memPct = totalMem > 0 ? (proc.memory_bytes / totalMem) * 100 : 0;
  const initial = proc.name.charAt(0).toUpperCase();
  const colors = [
    "bg-brand-500/20 text-brand-600 dark:text-brand-200",
    "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
    "bg-amber-500/20 text-amber-600 dark:text-amber-300",
    "bg-pink-500/20 text-pink-600 dark:text-pink-300",
    "bg-sky-500/20 text-sky-600 dark:text-sky-300",
  ];
  const colorClass = colors[initial.charCodeAt(0) % colors.length];

  return (
    <div className="grid grid-cols-[28px_1fr_140px_70px_70px_80px] gap-0 items-center px-4 py-2.5 border-b border-surface-200 dark:border-white/5 hover:bg-surface-50 dark:hover:bg-white/3 transition-colors group">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-semibold ${colorClass}`}>
        {initial}
      </div>
      <div className="pl-3">
        <p className="text-sm text-surface-900 dark:text-white/85 truncate max-w-[240px]">{proc.name}</p>
        <p className="text-[10px] text-surface-400 dark:text-white/30">PID {proc.pid}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-surface-100 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor(memPct)}`}
            style={{ width: `${Math.min(100, memPct)}%` }}
          />
        </div>
        <span className="text-xs text-surface-600 dark:text-white/70 font-mono min-w-[58px] text-right">
          {proc.memory_label}
        </span>
      </div>
      <span className="text-xs text-surface-400 dark:text-white/40 font-mono text-right pr-2">
        {proc.cpu_usage.toFixed(1)}%
      </span>
      <span className="text-[10px] text-surface-300 dark:text-white/25 font-mono text-right pr-4">
        {proc.threads > 0 ? `${proc.threads}t` : "—"}
      </span>
      <button
        onClick={() => onKill(proc.pid)}
        disabled={killing}
        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-30"
      >
        <Skull size={10} />
        Kill
      </button>
    </div>
  );
}

export function MemoryTab() {
  const queryClient = useQueryClient();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set());

  const { data: processes = [] } = useQuery({
    queryKey: ["processes"],
    queryFn: api.getProcesses,
  });

  const { data: sysInfo } = useQuery({
    queryKey: ["sysInfo"],
    queryFn: api.getSystemInfo,
  });

  const { data: disks = [] } = useQuery({
    queryKey: ["disks"],
    queryFn: api.getDisks,
  });

  const { data: battery } = useQuery({
    queryKey: ["battery"],
    queryFn: api.getBattery,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const fmtTemp = (c: number) => {
    if (settings?.temp_unit === "f") return `${((c * 9/5) + 32).toFixed(0)}°F`;
    return `${c.toFixed(0)}°C`;
  };

  // Refresh when backend emits process-update
  useEffect(() => {
    const unlisten = listen("process-update", () => {
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      queryClient.invalidateQueries({ queryKey: ["sysInfo"] });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [queryClient]);

  const killMutation = useMutation({
    mutationFn: api.killProcess,
    onMutate: (pid) => setKillingPids((s) => new Set(s).add(pid)),
    onError: (err) => {
      console.error(err);
      alert(`Could not kill process: ${err}`);
    },
    onSettled: (_, __, pid) => {
      setKillingPids((s) => { const n = new Set(s); n.delete(pid); return n; });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
    },
  });

  const filtered = processes.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMem  = sysInfo?.total_memory ?? 1;
  const usedMem   = sysInfo?.used_memory ?? 0;
  const memPct    = (usedMem / totalMem) * 100;
  const cpuPct    = sysInfo?.cpu_usage ?? 0;

  const totalDisk = disks.reduce((a, d) => a + d.total_bytes, 0);
  const usedDisk  = disks.reduce((a, d) => a + d.used_bytes, 0);
  const diskPct   = totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0;

  const batCharge  = battery?.charge_percent ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="RAM usage"
          value={fmtBytes(usedMem)}
          sub={`of ${fmtBytes(totalMem)}`}
          pct={memPct}
          icon={<MemoryStick size={14} />}
        />
        <StatCard
          label="CPU"
          value={`${cpuPct.toFixed(0)}%`}
          sub={`${sysInfo?.cpu_count ?? 0} cores · ${sysInfo?.cpu_brand ?? "—"}`}
          pct={cpuPct}
          icon={<Cpu size={14} />}
          badge={sysInfo && sysInfo.cpu_temp > 0 && (
            <div className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors ${
              sysInfo.cpu_temp > 80 ? "bg-red-500/10 text-red-400 border-red-500/20" :
              sysInfo.cpu_temp > 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {fmtTemp(sysInfo.cpu_temp)}
            </div>
          )}
        />
        <StatCard
          label="Disk"
          value={fmtBytes(usedDisk)}
          sub={`of ${fmtBytes(totalDisk)}`}
          pct={diskPct}
          icon={<HardDrive size={14} />}
        />
        <StatCard
          label="Battery"
          value={battery?.present ? `${batCharge.toFixed(0)}%` : "N/A"}
          sub={battery?.present ? `Health ${(battery?.health_percent ?? 0).toFixed(0)}%` : "No battery"}
          pct={batCharge}
          icon={<Battery size={14} />}
          colorFuncs={{
            bar: healthColor,
            text: healthPctColor
          }}
        />
      </div>

      <HistoryChart />

      {/* Process table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[28px_1fr_140px_70px_70px_80px] gap-0 px-4 py-2.5 border-b border-surface-200 dark:border-white/5 bg-surface-50 dark:bg-white/2">
          <div />
          <p className="pl-3 text-[11px] font-medium text-surface-400 dark:text-white/30 uppercase tracking-widest">Process</p>
          <p className="text-[11px] font-medium text-surface-400 dark:text-white/30 uppercase tracking-widest">Memory</p>
          <p className="text-[11px] font-medium text-surface-400 dark:text-white/30 uppercase tracking-widest text-right pr-2">CPU</p>
          <p className="text-[11px] font-medium text-surface-400 dark:text-white/30 uppercase tracking-widest text-right pr-4">Threads</p>
          <p className="text-[11px] font-medium text-surface-400 dark:text-white/30 uppercase tracking-widest">Action</p>
        </div>

        {/* Rows */}
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-surface-400 dark:text-white/25 text-sm">
              No processes found
            </div>
          ) : (
            filtered.map((proc) => (
              <ProcessRow
                key={proc.pid}
                proc={proc}
                totalMem={totalMem}
                onKill={(pid) => killMutation.mutate(pid)}
                killing={killingPids.has(proc.pid)}
              />
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-surface-200 dark:border-white/5 bg-surface-50 dark:bg-white/2">
          <p className="text-[10px] text-surface-400 dark:text-white/25">
            {filtered.length} processes · sorted by memory · auto-refreshes every 3s
          </p>
        </div>
      </div>
    </div>
  );
}
