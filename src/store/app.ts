import { create } from "zustand";
import type { TabId } from "@/types";

interface AppStore {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTab:    "memory",
  setActiveTab: (tab) => set({ activeTab: tab, searchQuery: "" }),
  searchQuery:  "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
