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

export interface SphereSettings {
  rotationSpeed: number; // 基础旋转速度 (rad/s)
  spinTurns: number;     // 抽奖旋转圈数
  spinDuration: number;  // 抽奖持续时间 (s)
  extraRevs: number;     // 停止前的额外旋转圈数
}
