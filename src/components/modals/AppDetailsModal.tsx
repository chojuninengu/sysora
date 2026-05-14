import { useState, useEffect } from "react";
import { X, ExternalLink, HardDrive, Info, Trash2, AppWindow } from "lucide-react";
import type { AppInfo } from "@/types";

interface Props {
  app: AppInfo;
  onClose: () => void;
  onUninstall: (app: AppInfo) => void;
}

function AppIcon({ icon_path, className = "w-12 h-12 object-contain" }: { icon_path?: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (icon_path) {
      import("@/lib/api").then(({ api }) => {
        api.getAppIconDataUrl(icon_path)
          .then(setSrc)
          .catch(() => setSrc(null));
      });
    }
  }, [icon_path]);

  if (!src) return <AppWindow size={32} className="text-surface-200 dark:text-white/10" />;

  return <img src={src} alt="" className={className} />;
}

export function AppDetailsModal({ app, onClose, onUninstall }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-surface-200 dark:border-white/5 flex items-center justify-between bg-surface-50 dark:bg-white/2">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Info size={16} />
             </div>
             <h2 className="text-sm font-semibold text-surface-900 dark:text-white/90">Application Details</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-white/5 text-surface-400 dark:text-white/30 hover:text-surface-900 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-surface-50 dark:bg-white/5 flex items-center justify-center border border-surface-200 dark:border-white/5 overflow-hidden">
               <AppIcon icon_path={app.icon_path} className="w-12 h-12 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-surface-900 dark:text-white leading-tight mb-1">{app.name}</h3>
              <p className="text-sm text-surface-400 dark:text-white/40">Version {app.version || "0.1.0"}</p>
            </div>
          </div>

          <div className="grid gap-4">
             <DetailItem 
                icon={<HardDrive size={14} />} 
                label="Install Path" 
                value={app.install_path} 
                isPath
             />
             <DetailItem 
                icon={<Info size={14} />} 
                label="ID / Desktop File" 
                value={app.id} 
             />
             {app.icon_path && (
               <DetailItem 
                  icon={<ExternalLink size={14} />} 
                  label="Icon Path" 
                  value={app.icon_path} 
                  isPath
               />
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-50 dark:bg-white/2 border-t border-surface-200 dark:border-white/5 flex items-center justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-xs font-medium text-surface-400 dark:text-white/60 hover:text-surface-900 dark:hover:text-white transition-colors"
           >
             Close
           </button>
           <button 
             onClick={() => onUninstall(app)}
             className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-all"
           >
             <Trash2 size={14} />
             Uninstall App
           </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, isPath }: { icon: React.ReactNode; label: string; value: string; isPath?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-medium text-surface-300 dark:text-white/25 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`p-2.5 rounded-lg bg-surface-50 dark:bg-white/3 border border-surface-200 dark:border-white/5 text-[11px] text-surface-600 dark:text-white/60 select-text ${isPath ? 'font-mono' : ''} break-all`}>
        {value}
      </div>
    </div>
  );
}
