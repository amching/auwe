import { create } from "zustand";

interface CommandMenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** 命令面板（⌘K）开合——瞬时 UI 状态，不持久化。 */
export const useCommandMenu = create<CommandMenuState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
