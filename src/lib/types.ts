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
