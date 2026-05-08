import { useQuery } from "@tanstack/react-query";
import { HardDrive, Usb } from "lucide-react";
import { api } from "@/lib/api";
import { fmtBytes, barColor } from "@/lib/utils";

export function DiskTab() {
  const { data: disks = [], isLoading } = useQuery({
    queryKey: ["disks"],
    queryFn: api.getDisks,
  });

  if (isLoading) {
    return <div className="py-20 text-center text-white/25 text-sm">Scanning disks…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-white/30">
        {disks.length} disk{disks.length !== 1 ? "s" : ""} detected
      </p>
      {disks.map((disk, i) => {
        const usedPct = disk.total_bytes > 0
          ? (disk.used_bytes / disk.total_bytes) * 100
          : 0;
        return (
          <div key={i} className="card p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {disk.removable
                  ? <Usb size={18} className="text-amber-400" />
                  : <HardDrive size={18} className="text-brand-400" />}
                <div>
                  <p className="text-sm font-medium text-white/85">{disk.name || disk.mount}</p>
                  <p className="text-[11px] text-white/30">
                    {disk.mount} · {disk.file_system}
                    {disk.removable ? " · Removable" : ""}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${usedPct >= 85 ? "text-red-400" : usedPct >= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                {usedPct.toFixed(1)}%
              </span>
            </div>

            <div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(usedPct)}`}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] text-white/35">
                  Used: {fmtBytes(disk.used_bytes)}
                </span>
                <span className="text-[11px] text-white/35">
                  Free: {fmtBytes(disk.available_bytes)} of {fmtBytes(disk.total_bytes)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {disks.length === 0 && (
        <div className="py-20 text-center text-white/25 text-sm">No disks detected</div>
      )}
    </div>
  );
}
