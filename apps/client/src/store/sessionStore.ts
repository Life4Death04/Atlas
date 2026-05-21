import { create } from 'zustand';

type SessionStore = {
  isSessionActive: boolean;
  activeRoutineId: string | null;
  startSession: (routineId: string) => void;
  endSession: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  isSessionActive: false,
  activeRoutineId: null,
  startSession: (routineId) => set({ isSessionActive: true, activeRoutineId: routineId }),
  endSession: () => set({ isSessionActive: false, activeRoutineId: null }),
}));
