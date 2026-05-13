import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Info, Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/app";
import type { AppInfo } from "@/types";

export function AppsTab() {
  const queryClient = useQueryClient();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: api.getInstalledApps,
    refetchOnWindowFocus: false,
  });

  const uninstallMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => api.uninstallApp(id, path),
    onMutate: ({ id }) => setUninstallingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      setUninstallingId(null);
    },
    onError: (err: any) => {
      alert(`Uninstallation failed: ${err}`);
      setUninstallingId(null);
    },
  });

  const handleUninstall = (app: AppInfo) => {
    if (window.confirm(`Are you sure you want to uninstall ${app.name}?`)) {
      uninstallMutation.mutate({ id: app.id, path: app.install_path });
    }
  };

  const filtered = apps.filter((app) =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-semibold text-white/90">Installed Applications</h2>
          <p className="text-xs text-white/30">View and manage apps installed on your system</p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/40 font-mono">
          {filtered.length} {filtered.length === 1 ? 'App' : 'Apps'} found
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
             <div className="w-10 h-10 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
             <p className="text-sm text-white/30 italic font-medium">Scanning system for applications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
             <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <AppWindow size={20} className="text-white/20" />
             </div>
             <div className="space-y-1">
                <p className="text-sm text-white/40 font-medium">No applications found</p>
                <p className="text-[11px] text-white/20 max-w-[200px]">Try adjusting your search query to find what you're looking for.</p>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
            {filtered.map((app) => {
              const isWorking = uninstallingId === app.id;
              return (
                <div 
                  key={`${app.name}-${app.install_path}`} 
                  className={`card-hover group p-3 flex items-center gap-3 relative ${isWorking ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/10 transition-colors flex-shrink-0">
                    {isWorking ? <Loader2 size={20} className="animate-spin" /> : <AppWindow size={20} />}
                  </div>
                  <div className="flex-1 min-w-0 pr-12">
                    <h3 className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                      {app.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/25 truncate">
                        {app.version || "0.1.0"}
                      </span>
                      {app.version && (
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                      )}
                      <span className="text-[10px] text-white/25 truncate max-w-[120px]">
                        {app.install_path.split('/').pop()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      title="View Details"
                      className="p-1.5 rounded-md hover:bg-white/5 text-white/30 hover:text-brand-400 transition-all"
                    >
                      <Info size={14} />
                    </button>
                    <button 
                      onClick={() => handleUninstall(app)}
                      title="Uninstall Application"
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
