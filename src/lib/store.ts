import type { AppState, Prize, Language, AppMode } from './types';
import names from '../data/name';
import { createPrize } from './prizeConfigState';

type Listener = (state: AppState) => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    // Try to load from localStorage
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('pachinko_state') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Data migration/fix for new fields
        this.state = {
          ...this.getInitialState(),
          ...parsed
        };
      } catch (e) {
        this.state = this.getInitialState();
      }
    } else {
      this.state = this.getInitialState();
    }
  }

  private getInitialState(): AppState {
    const defaultPrizes = [
      createPrize('一等奖', 1),
      createPrize('二等奖', 2),
      createPrize('三等奖', 5)
    ];
    return {
      mode: 'prize',
      candidates: [...names],
      prizes: defaultPrizes,
      results: {},
      freeResults: [],
      freeInitialCandidates: [...names],
      currentPrizeId: defaultPrizes[0].id,
      language: (typeof localStorage !== 'undefined' ? localStorage.getItem('lang') as Language : 'zh') || 'zh',
      isDrawing: false
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(newState: Partial<AppState>) {
    this.state = { ...this.state, ...newState };
    this.persist();
    this.notify();
  }

  private persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pachinko_state', JSON.stringify(this.state));
      localStorage.setItem('lang', this.state.language);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  // Helper actions
  updateCandidates(newCandidates: string[]) {
    this.setState({ candidates: newCandidates });
  }

  updatePrizes(newPrizes: Prize[]) {
    this.setState({ prizes: newPrizes });
  }

  setResults(results: Record<string, string[]>) {
    this.setState({ results });
  }

  setCurrentPrize(id: string) {
    this.setState({ currentPrizeId: id });
  }

  setLanguage(lang: Language) {
    this.setState({ language: lang });
  }

  setDrawing(isDrawing: boolean) {
    this.setState({ isDrawing });
  }

  setMode(mode: AppMode) {
    const updates: Partial<AppState> = { mode };
    // If entering free mode, take a snapshot of current candidates
    if (mode === 'free') {
      updates.freeInitialCandidates = [...this.state.candidates];
    }
    this.setState(updates);
  }

  addFreeResult(name: string) {
    this.setState({
      freeResults: [name, ...this.state.freeResults],
      candidates: this.state.candidates.filter(n => n !== name)
    });
  }

  undoFree() {
    if (this.state.freeResults.length === 0) return;
    const [last, ...rest] = this.state.freeResults;
    this.setState({
      freeResults: rest,
      candidates: [last, ...this.state.candidates]
    });
  }

  resetFree() {
    this.setState({
      candidates: [...this.state.freeInitialCandidates],
      freeResults: []
    });
  }

  clearFreeResults() {
    this.setState({ freeResults: [] });
  }

  addResults(prizeId: string, names: string[]) {
    const currentResults = { ...this.state.results };
    currentResults[prizeId] = [...(currentResults[prizeId] || []), ...names];
    this.setState({ results: currentResults });
  }

  removeCandidates(names: string[]) {
    this.setState({
      candidates: this.state.candidates.filter(n => !names.includes(n))
    });
  }

  clearResults() {
    const currentResults = this.state.results;
    const allWinners = Object.values(currentResults).flat();
    this.setState({
      results: {},
      candidates: [...this.state.candidates, ...allWinners]
    });
  }

  reset() {
    const initialState = this.getInitialState();
    this.setState(initialState);
  }
}

export const store = new Store();
