import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Cpu, MemoryStick, BatteryWarning, Clock, FileText, Download, Loader2, Thermometer } from "lucide-react";
import { api } from "@/lib/api";
import { fmtBytes, fmtUptime, healthColor, healthLabel } from "@/lib/utils";
import { save } from "@tauri-apps/plugin-dialog";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-200 dark:border-white/5 last:border-0">
      <span className="text-xs text-surface-400 dark:text-white/40">{label}</span>
      <span className="text-xs text-surface-900 dark:text-white/80 font-mono text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 flex flex-col gap-1 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-brand-600 dark:text-brand-400">{icon}</span>
        <h2 className="text-sm font-medium text-surface-700 dark:text-white/70">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function SystemInfoTab() {
  const { data: sys } = useQuery({ queryKey: ["sysInfo"],  queryFn: api.getSystemInfo });
  const { data: bat } = useQuery({ queryKey: ["battery"],  queryFn: api.getBattery });
  const { data: temps } = useQuery({ queryKey: ["temps"], queryFn: api.getTemperatures });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  
  const [exporting, setExporting] = useState(false);

  const fmtTemp = (c: number) => {
    if (settings?.temp_unit === "f") return `${((c * 9/5) + 32).toFixed(0)}°F`;
    return `${c.toFixed(0)}°C`;
  };

  const handleExport = async () => {
    try {
      const path = await save({
        title: "Export Machine Report",
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: `sysora_report_${sys?.hostname || "machine"}.pdf`
      });

      if (path) {
        setExporting(true);
        await api.exportReport(path);
        alert(`Success! Report exported to:\n${path}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Export failed: ${err.toString()}`);
    } finally {
      setExporting(false);
    }
  };

  const memPct = sys ? (sys.used_memory / sys.total_memory) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/10">
            <Monitor size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-surface-900 dark:text-white">System Information</h1>
            <p className="text-xs text-surface-400 dark:text-white/30 uppercase tracking-widest font-bold">Hardware & Software Specs</p>
          </div>
        </div>

        <button 
          onClick={handleExport}
          disabled={exporting || !sys}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-brand-500/10"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {exporting ? "Generating PDF..." : "Export Full Report"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-8">
        {/* OS */}
        <Section icon={<Monitor size={15} />} title="Operating System">
          <InfoRow label="OS"       value={`${sys?.os_name ?? "—"} ${sys?.os_version ?? ""}`} />
          <InfoRow label="Kernel"   value={sys?.kernel_version ?? "—"} />
          <InfoRow label="Hostname" value={sys?.hostname ?? "—"} />
          <InfoRow label="Uptime"   value={sys ? fmtUptime(sys.uptime_secs) : "—"} />
        </Section>

        {/* CPU */}
        <Section icon={<Cpu size={15} />} title="Processor">
          <InfoRow label="Model"  value={sys?.cpu_brand ?? "—"} />
          <InfoRow label="Cores"  value={sys ? `${sys.cpu_count} logical cores` : "—"} />
          <div className="flex items-center justify-between py-2.5 border-b border-surface-200 dark:border-white/5 last:border-0">
            <span className="text-xs text-surface-400 dark:text-white/40">Temperature</span>
            <span className={`text-xs font-mono font-bold ${
              (sys?.cpu_temp ?? 0) > 80 ? "text-red-600 dark:text-red-400" :
              (sys?.cpu_temp ?? 0) > 60 ? "text-amber-600 dark:text-amber-400" :
              "text-emerald-600 dark:text-emerald-400"
            }`}>
              {sys ? fmtTemp(sys.cpu_temp) : "—"}
            </span>
          </div>
          <InfoRow label="Usage"  value={sys ? `${sys.cpu_usage.toFixed(1)}%` : "—"} />
        </Section>

        {/* Memory */}
        <Section icon={<MemoryStick size={15} />} title="Memory">
          <InfoRow label="Total RAM"  value={sys ? fmtBytes(sys.total_memory) : "—"} />
          <InfoRow label="Used"       value={sys ? fmtBytes(sys.used_memory)  : "—"} />
          <InfoRow label="Free"       value={sys ? fmtBytes(sys.total_memory - sys.used_memory) : "—"} />
          <InfoRow label="Usage"      value={`${memPct.toFixed(1)}%`} />
          <InfoRow label="Swap total" value={sys ? fmtBytes(sys.total_swap) : "—"} />
          <InfoRow label="Swap used"  value={sys ? fmtBytes(sys.used_swap)  : "—"} />
        </Section>

        {/* Battery */}
        <Section icon={<BatteryWarning size={15} />} title="Battery Health">
          {!bat?.present ? (
            <p className="text-xs text-surface-400 dark:text-white/30 py-2">No battery detected — desktop machine or unsupported platform.</p>
          ) : (
            <>
              <InfoRow label="Current charge"    value={`${bat.charge_percent.toFixed(0)}%`} />
              <InfoRow label="Health"            value={`${bat.health_percent.toFixed(0)}% — ${healthLabel(bat.health_percent)}`} />
              <InfoRow label="Design capacity"   value={bat.design_capacity_mwh   ? `${bat.design_capacity_mwh.toLocaleString()} mWh` : "—"} />
              <InfoRow label="Current max cap."  value={bat.current_capacity_mwh  ? `${bat.current_capacity_mwh.toLocaleString()} mWh` : "—"} />
              <InfoRow label="Cycle count"       value={bat.cycle_count != null   ? `${bat.cycle_count} cycles` : "—"} />
              <InfoRow label="Status"            value={bat.status} />

              {/* Health bar */}
              <div className="mt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-surface-400 dark:text-white/30">0%</span>
                  <span className="text-[10px] text-surface-400 dark:text-white/30">Design capacity 100%</span>
                </div>
                <div className="relative h-2.5 rounded-full bg-surface-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${healthColor(bat.health_percent)}`}
                    style={{ width: `${bat.health_percent}%` }}
                  />
                  {/* Design capacity marker */}
                  <div className="absolute right-0 top-0 h-full w-px bg-surface-200 dark:bg-white/20" />
                </div>
                <p className="text-[10px] text-surface-400 dark:text-white/30 mt-1 text-right">
                  Current max: {bat.health_percent.toFixed(0)}% of original
                </p>
              </div>
            </>
          )}
        </Section>

        {/* Temperatures */}
        <div className="col-span-2">
          <Section icon={<Thermometer size={15} />} title="Detailed Hardware Sensors">
            {temps && temps.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                {temps.map((t) => (
                  <div key={t.label} className="flex items-center justify-between py-2 border-b border-surface-200 dark:border-white/5 last:border-0">
                    <span className="text-[11px] text-surface-400 dark:text-white/40 truncate max-w-[150px]">{t.label}</span>
                    <div className="flex items-center gap-3">
                       <span className={`text-xs font-mono font-bold ${
                         t.current_celsius > 80 ? "text-red-600 dark:text-red-400" :
                         t.current_celsius > 60 ? "text-amber-600 dark:text-amber-400" :
                         "text-emerald-600 dark:text-emerald-400"
                       }`}>
                         {fmtTemp(t.current_celsius)}
                       </span>
                       <span className="text-[9px] text-surface-300 dark:text-white/20 uppercase font-mono">Max {fmtTemp(t.max_celsius)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-surface-400 dark:text-white/30 py-2">No hardware sensor data available for this platform.</p>
            )}
          </Section>
        </div>

        {/* Quick specs summary card — great for sharing machine specs */}
        <div className="col-span-2 card p-5 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-medium text-surface-800 dark:text-white/70">Quick Spec Summary</h2>
            <span className="ml-auto text-[10px] text-surface-400 dark:text-white/25">Share this when selling your machine</span>
          </div>
          <div className="font-mono text-xs text-surface-600 dark:text-white/60 bg-surface-50 dark:bg-black/20 border border-surface-100 dark:border-none rounded-lg p-4 leading-relaxed select-text">
            <p>Machine:  {sys?.hostname ?? "—"}</p>
            <p>OS:       {sys?.os_name ?? "—"} {sys?.os_version ?? ""} (Kernel {sys?.kernel_version ?? "—"})</p>
            <p>CPU:      {sys?.cpu_brand ?? "—"} · {sys?.cpu_count ?? 0} cores</p>
            <p>RAM:      {sys ? fmtBytes(sys.total_memory) : "—"} total</p>
            {bat?.present && (
              <p>Battery:  Health {bat.health_percent.toFixed(0)}% · {bat.cycle_count ?? "?"} cycles · {bat.current_capacity_mwh ?? "?"}mWh remaining capacity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
