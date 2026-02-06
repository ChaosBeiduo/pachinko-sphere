import type { Prize } from './types';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

export const createPrize = (title: string, count: number, note?: string): Prize => {
  if (!title.trim()) throw new Error('Title cannot be empty');
  if (count < 1 || !Number.isInteger(count)) throw new Error('Count must be a positive integer');
  
  return {
    id: generateId(),
    title: title.trim(),
    count,
    note: note?.trim()
  };
};

export const validatePrizeList = (prizes: Prize[]): string | null => {
  const titles = new Set<string>();
  for (const prize of prizes) {
    if (titles.has(prize.title)) {
      return `Duplicate prize title: ${prize.title}`;
    }
    titles.add(prize.title);
  }
  return null;
};
