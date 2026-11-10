import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEMO_USERS } from "@/lib/seed";
import type { DemoUser } from "@/lib/types";

interface AppState {
  currentUserId: string;
  branchFilter: string; // "all" or a branch id
  hydrated: boolean;
  setUser: (id: string) => void;
  setBranchFilter: (id: string) => void;
  setHydrated: (v: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: "u1",
      branchFilter: "all",
      hydrated: false,
      setUser: (id) => set({ currentUserId: id }),
      setBranchFilter: (id) => set({ branchFilter: id }),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "savora-app-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ currentUserId: s.currentUserId, branchFilter: s.branchFilter }),
    },
  ),
);

export function useCurrentUser(): DemoUser {
  const id = useApp((s) => s.currentUserId);
  return DEMO_USERS.find((u) => u.id === id) ?? DEMO_USERS[0]!;
}
