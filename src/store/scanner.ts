import { create } from "zustand";
import { DiskEntry, ScanProgress } from "@/types";

interface ScannerStore {
  isScanning: boolean;
  progress: ScanProgress | null;
  results: DiskEntry[];
  scanPath: string;
  history: string[];
  error: string | null;
  
  setIsScanning: (val: boolean) => void;
  setProgress: (val: ScanProgress | null) => void;
  setResults: (val: DiskEntry[]) => void;
  setScanPath: (val: string) => void;
  setHistory: (val: string[]) => void;
  setError: (val: string | null) => void;
  reset: () => void;
}

export const useScannerStore = create<ScannerStore>((set) => ({
  isScanning: false,
  progress: null,
  results: [],
  scanPath: "",
  history: [],
  error: null,

  setIsScanning: (val) => set({ isScanning: val }),
  setProgress: (val) => set({ progress: val }),
  setResults: (val) => set({ results: val }),
  setScanPath: (val) => set({ scanPath: val }),
  setHistory: (val) => set({ history: val }),
  setError: (val) => set({ error: val }),
  reset: () => set({ isScanning: false, progress: null, results: [], error: null }),
}));
