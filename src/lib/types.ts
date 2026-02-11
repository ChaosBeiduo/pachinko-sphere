export interface Prize {
  id: string;
  title: string;
  count: number;
  note?: string;
}

export interface DrawResult {
  winners: string[];
  remainingCandidates: string[];
}

export type Language = 'zh' | 'en';

export interface AppState {
  candidates: string[];
  prizes: Prize[];
  results: Record<string, string[]>; // prizeId -> winnerNames[]
  currentPrizeId: string;
  language: Language;
  isDrawing: boolean;
}
