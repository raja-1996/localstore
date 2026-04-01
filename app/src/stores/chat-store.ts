import { create } from 'zustand';

interface ChatState {
  totalUnread: number;
  setTotalUnread: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: (count: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  totalUnread: 0,

  setTotalUnread: (count: number) =>
    set({ totalUnread: Math.max(0, count) }),

  incrementUnread: () =>
    set((state) => ({ totalUnread: state.totalUnread + 1 })),

  decrementUnread: (count: number) =>
    set((state) => ({ totalUnread: Math.max(0, state.totalUnread - count) })),
}));
