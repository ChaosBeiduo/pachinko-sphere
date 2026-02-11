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
export type AppMode = 'prize' | 'free';

export interface AppState {
  mode: AppMode;
  candidates: string[];
  prizes: Prize[];
  results: Record<string, string[]>; // prizeId -> winnerNames[]
  freeResults: string[];             // 自由模式结果
  freeInitialCandidates: string[];   // 自由模式重置参考
  currentPrizeId: string;
  language: Language;
  isDrawing: boolean;
}

export interface SphereSettings {
  rotationSpeed: number; // 基础旋转速度 (rad/s)
  spinTurns: number;     // 抽奖旋转圈数
  spinDuration: number;  // 抽奖持续时间 (s)
  extraRevs: number;     // 停止前的额外旋转圈数
  extraOmega: number;    // 平行旋转角速度 (rad/s)
  extraBlendDuration: number; // 旋转过渡混合时长 (ms)
}
