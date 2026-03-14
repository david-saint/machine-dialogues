import { create } from 'zustand';

interface PlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTurnIndex: number;
  speed: number;
  isMuted: boolean;
  highlightPosition: { charIndex: number; charLength: number } | null;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setCurrentTurnIndex: (index: number) => void;
  setSpeed: (speed: number) => void;
  setMuted: (muted: boolean) => void;
  setHighlightPosition: (pos: { charIndex: number; charLength: number } | null) => void;
  nextTurn: () => void;
  prevTurn: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  isLoading: false,
  currentTurnIndex: -1,
  speed: 1,
  isMuted: false,
  highlightPosition: null,
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCurrentTurnIndex: (index) => set({ currentTurnIndex: index }),
  setSpeed: (speed) => set({ speed }),
  setMuted: (muted) => set({ isMuted: muted }),
  setHighlightPosition: (pos) => set({ highlightPosition: pos }),
  nextTurn: () => set((state) => ({ currentTurnIndex: state.currentTurnIndex + 1 })),
  prevTurn: () => set((state) => ({ currentTurnIndex: Math.max(-1, state.currentTurnIndex - 1) })),
}));
