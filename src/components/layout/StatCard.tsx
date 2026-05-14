import { barColor, pctColor } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  pct: number;
  icon: React.ReactNode;
  colorFuncs?: {
    bar: (pct: number) => string;
    text: (pct: number) => string;
  };
  badge?: React.ReactNode;
}

export function StatCard({ label, value, sub, pct, icon, colorFuncs, badge }: StatCardProps) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const barClass = colorFuncs?.bar ? colorFuncs.bar(clampedPct) : barColor(clampedPct);
  const textClass = colorFuncs?.text ? colorFuncs.text(clampedPct) : pctColor(clampedPct);

  return (
    <div className="card p-4 flex flex-col gap-2 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 uppercase tracking-widest">{label}</span>
          {badge}
        </div>
        <span className="text-white/20">{icon}</span>
      </div>
      <div>
        <span className="text-2xl font-semibold text-white">{value}</span>
        <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${textClass}`}>
        {clampedPct.toFixed(0)}%
      </span>
    </div>
  );
}
