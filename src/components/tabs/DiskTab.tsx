import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  HardDrive, 
  Usb, 
  Search, 
  Folder, 
  File, 
  ChevronRight, 
  Play, 
  Loader2, 
  ArrowLeft,
  Trash2,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";
import { fmtBytes, barColor } from "@/lib/utils";
import { listen } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import { DiskEntry, ScanProgress } from "@/types";
import { useScannerStore } from "@/store/scanner";

export function DiskTab() {
  const {
    isScanning, setIsScanning,
    progress, setProgress,
    results, setResults,
    scanPath, setScanPath,
    history, setHistory,
    error, setError,
    reset
  } = useScannerStore();

  const { data: disks = [], isLoading: disksLoading } = useQuery({
    queryKey: ["disks"],
    queryFn: api.getDisks,
  });

  // Initialize path and sync state
  useEffect(() => {
    const init = async () => {
      // Set home dir if path is empty
      if (!scanPath) {
        try {
          const home = await homeDir();
          setScanPath(home);
        } catch (e) {
          console.error(e);
        }
      }

      // Sync state from backend in case a scan is running or finished
      try {
        const [backendIsScanning, backendResults] = await api.getScanResults();
        setIsScanning(backendIsScanning);
        if (backendResults.length > 0) {
          setResults(backendResults);
        }
      } catch (e) {
        console.error("Failed to sync scan state:", e);
      }
    };
    init();
  }, []);

  // Event listeners
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenFinished: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenProgress = await listen<ScanProgress>("scan-progress", (event) => {
        setProgress(event.payload);
      });
      
      unlistenFinished = await listen<DiskEntry[]>("scan-finished", (event) => {
        setResults(event.payload);
        setIsScanning(false);
        setProgress(null);
      });
    };
    
    setupListeners();
    
    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenFinished) unlistenFinished();
    };
  }, [setIsScanning, setProgress, setResults]);

  const startScan = async (path: string = scanPath) => {
    if (!path) return;
    setError(null);
    setIsScanning(true);
    setResults([]);
    setProgress({ scanned: 0, current_path: "Initializing background scan..." });
    
    try {
      await api.scanDirectory(path);
      // We don't await results here anymore as they come via events
      setScanPath(path);
    } catch (err: any) {
      console.error(err);
      setError(err.toString());
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleDrillDown = (entry: DiskEntry) => {
    if (entry.is_dir && !isScanning) {
      setHistory([...history, scanPath]);
      startScan(entry.path);
    }
  };

  const handleBack = () => {
    if (isScanning) return;
    const newHistory = [...history];
    const prev = newHistory.pop();
    if (prev) {
      setHistory(newHistory);
      startScan(prev);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await api.deletePath(path);
      setResults(results.filter((r) => r.path !== path));
    } catch (e) {
      console.error(e);
      setError("Failed to delete item. It might be in use or require higher permissions.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-5xl mx-auto">
      {/* Partitions Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white/50 px-1">
          <HardDrive size={14} className="text-brand-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Storage Partitions</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {disksLoading ? (
             <div className="col-span-full h-24 bg-white/[0.02] rounded-2xl flex items-center justify-center border border-white/5 border-dashed">
                <Loader2 className="animate-spin text-white/10" size={24} />
             </div>
          ) : disks.map((disk, i) => {
            const usedPct = disk.total_bytes > 0 ? (disk.used_bytes / disk.total_bytes) * 100 : 0;
            return (
              <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/10 p-5 space-y-4 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${disk.removable ? 'bg-amber-400/10' : 'bg-brand-400/10'}`}>
                      {disk.removable ? <Usb size={18} className="text-amber-400" /> : <HardDrive size={18} className="text-brand-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{disk.name || disk.mount}</p>
                      <p className="text-[10px] text-white/30 font-medium tracking-tight truncate max-w-[120px]">{disk.mount} · {disk.file_system}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold ${usedPct >= 85 ? "text-red-400" : usedPct >= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                    {usedPct.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${barColor(usedPct)} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} style={{ width: `${usedPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-white/20 uppercase tracking-wider">
                    <span>Used: {fmtBytes(disk.used_bytes)}</span>
                    <span>Free: {fmtBytes(disk.available_bytes)} of {fmtBytes(disk.total_bytes)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Disk Usage Scanner Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-white/50 px-1">
          <Search size={14} className="text-emerald-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Storage Analyzer</h3>
        </div>

        <div className="bg-white/[0.03] rounded-3xl border border-white/10 overflow-hidden backdrop-blur-sm shadow-xl">
          {/* Top Control Bar */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.01]">
             {history.length > 0 && (
               <button 
                 onClick={handleBack} 
                 disabled={isScanning}
                 className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl text-white/60 transition-all active:scale-90"
                 title="Go back"
               >
                  <ArrowLeft size={18} />
               </button>
             )}
             <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/5 px-4 h-10 flex items-center gap-3 group focus-within:border-brand-400/30 transition-all">
                <Folder size={14} className="text-white/20 group-focus-within:text-brand-400 transition-colors" />
                <input 
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  disabled={isScanning}
                  className="bg-transparent border-none focus:ring-0 text-[11px] text-white/60 w-full font-mono placeholder:text-white/10"
                  placeholder="Paste a path to scan..."
                />
             </div>
             <button 
               onClick={() => startScan()}
               disabled={isScanning || !scanPath}
               className="h-10 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed text-emerald-950 font-bold px-6 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
             >
                {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                <span className="text-xs uppercase tracking-widest">{isScanning ? "Scanning" : "Start Scan"}</span>
             </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3 animate-slide-down">
               <AlertCircle size={14} className="text-red-400 shrink-0" />
               <p className="text-[10px] font-bold text-red-400 uppercase tracking-tight">{error}</p>
            </div>
          )}

          {/* Real-time Progress Bar */}
          {isScanning && progress && (
             <div className="px-6 py-4 bg-emerald-500/5 border-b border-emerald-500/10 space-y-2">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                     <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Scanning Filesystem...</span>
                   </div>
                   <span className="text-[10px] font-mono font-bold text-emerald-400/60">{progress.scanned.toLocaleString()} items found</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 animate-pulse" style={{ width: '100%' }} />
                </div>
                <p className="text-[9px] text-white/20 truncate font-mono tracking-tight">{progress.current_path}</p>
             </div>
          )}

          {/* Results List */}
          <div className="divide-y divide-white/5 min-h-[300px]">
            {results.length > 0 ? results.map((entry, i) => (
              <div 
                key={i} 
                className={`p-4 flex items-center justify-between hover:bg-white/[0.04] transition-all group ${entry.is_dir && !isScanning ? 'cursor-pointer' : ''}`}
                onClick={() => !isScanning && handleDrillDown(entry)}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center border transition-all ${entry.is_dir ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 group-hover:scale-105' : 'bg-white/5 border-white/5 text-white/20'}`}>
                    {entry.is_dir ? <Folder size={18} fill="currentColor" fillOpacity={0.1} /> : <File size={18} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white/80 group-hover:text-brand-400 transition-colors truncate">{entry.name}</p>
                    <p className="text-[10px] text-white/20 font-medium truncate tracking-tight">{entry.path}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] font-mono font-bold text-white/40 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                      {fmtBytes(entry.size_bytes)}
                    </span>
                    
                    <button 
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Permanently delete "${entry.name}"?\n\nThis action cannot be undone.`
                        );

                        if (confirmed) {
                          handleDelete(entry.path);
                        }
                      }}
                      disabled={isScanning}
                      className="p-2 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:hidden"
                      title="Delete permanently"
                    >
                      <Trash2 size={14} />
                    </button>

                    {entry.is_dir && <ChevronRight size={14} className="text-white/10 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />}
                </div>
              </div>
            )) : !isScanning && (
              <div className="py-24 flex flex-col items-center justify-center text-center gap-5">
                 <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/5 shadow-inner">
                    <Search size={32} />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.25em]">Directory Analyzer</h3>
                    <p className="text-[11px] text-white/20 max-w-[240px] leading-relaxed">
                      Enter a path above (e.g. your home folder) to visualize disk space usage and find heavy files.
                    </p>
                 </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
