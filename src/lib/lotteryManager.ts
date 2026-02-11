import { store } from './store';
import { drawWinners } from './drawEngine';
import { modalManager } from './modalManager';
import { translations } from './i18n';
import { settingsStore } from './settingsStore';
import { computeSpinPlan } from './spinMath';
import type { LotterySphere } from '../components/LotterySphere';

export interface LotteryManagerOptions {
  sphere: LotterySphere | null;
  onDrawStart?: (prizeTitle: string) => void;
  onDrawComplete?: (prizeTitle: string, winners: string[]) => void;
  onWinnerHighlight?: (name: string) => void;
}

export class LotteryManager {
  private sphere: LotterySphere | null = null;
  private onDrawStart?: (prizeTitle: string) => void;
  private onDrawComplete?: (prizeTitle: string, winners: string[]) => void;
  private onWinnerHighlight?: (name: string) => void;

  constructor(options: LotteryManagerOptions) {
    this.sphere = options.sphere;
    this.onDrawStart = options.onDrawStart;
    this.onDrawComplete = options.onDrawComplete;
    this.onWinnerHighlight = options.onWinnerHighlight;
  }

  public setSphere(sphere: LotterySphere) {
    this.sphere = sphere;
  }

  private t(key: keyof typeof translations['zh'], params: Record<string, string | number> = {}) {
    const state = store.getState();
    // @ts-ignore
    let text = translations[state.language][key] || key;
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
    return text;
  }

  /**
   * Starts the lottery draw process
   */
  async startDraw() {
    const state = store.getState();
    if (state.isDrawing) return;

    if (state.mode === 'prize') {
      await this.drawPrize();
    } else {
      await this.drawFree();
    }
  }

  private async drawPrize() {
    const state = store.getState();
    const prize = state.prizes.find(p => p.id === state.currentPrizeId);
    if (!prize) return;

    // 1. Check for overwrite if this prize already has winners
    const existingWinners = state.results[prize.id];
    if (existingWinners && existingWinners.length > 0) {
      const confirmed = await modalManager.confirm('', { 
        messageKey: 'prizeOverwriteConfirm',
        messageParams: { prize: prize.title }
      });
      if (!confirmed) return;

      // Rollback previous winners to candidates list
      const newCandidates = [...state.candidates, ...existingWinners];
      const newResults = { ...state.results };
      delete newResults[prize.id];

      store.setState({
        candidates: newCandidates,
        results: newResults
      });
      
      this.sphere?.setNames(newCandidates);
    }

    const currentState = store.getState();
    if (currentState.candidates.length < prize.count) {
      modalManager.alert('', {
        messageKey: 'insufficientCandidates',
        messageParams: { 
          count: currentState.candidates.length, 
          needed: prize.count 
        }
      });
      return;
    }

    store.setDrawing(true);
    this.onDrawStart?.(prize.title);

    const settings = settingsStore.getSettings();
    const plan = computeSpinPlan({
      duration: settings.spinDuration,
      turns: settings.spinTurns,
      baseSpeed: settings.rotationSpeed
    });
    this.sphere?.spin(plan);

    const { winners, remainingCandidates } = drawWinners(currentState.candidates, prize.count);

    const DRAW_DELAY = settings.spinDuration * 1000 * 0.8;
    
    setTimeout(() => {
      this.sphere?.stopAndHighlightWinners(
        winners,
        (name) => this.onWinnerHighlight?.(name),
        () => {
          setTimeout(() => {
            store.setDrawing(false);
            store.addResults(prize.id, winners);
            store.removeCandidates(winners);
            this.onDrawComplete?.(prize.title, winners);
            this.sphere?.setNames(store.getState().candidates);
          }, 300);
        },
        { 
          extraRevs: settings.extraRevs,
          durationMs: Math.max(2200, plan.decelerationDuration + 600),
          nextExtraRevs: 1,
          nextDurationMs: 1200,
          finalPauseMs: 1200
        }
      );
    }, DRAW_DELAY);
  }

  private async drawFree() {
    const state = store.getState();
    if (state.candidates.length === 0) {
      modalManager.alert('', {
        messageKey: 'insufficientCandidates',
        messageParams: { count: 0, needed: 1 }
      });
      return;
    }

    store.setDrawing(true);
    this.onDrawStart?.('');

    const settings = settingsStore.getSettings();
    const plan = computeSpinPlan({
      duration: settings.spinDuration,
      turns: settings.spinTurns,
      baseSpeed: settings.rotationSpeed
    });
    this.sphere?.spin(plan);

    const { winners } = drawWinners(state.candidates, 1);
    
    // Runtime assertion: Ensure picked winner was actually in candidates and only one winner
    if (winners.length !== 1 || !state.candidates.includes(winners[0])) {
      console.error('Free mode draw error: invalid winner', { winners, candidates: state.candidates });
      store.setDrawing(false);
      return;
    }

    const DRAW_DELAY = settings.spinDuration * 1000 * 0.8;
    
    setTimeout(() => {
      this.sphere?.stopAndHighlightWinners(
        winners,
        (name) => this.onWinnerHighlight?.(name),
        () => {
          setTimeout(() => {
            store.setDrawing(false);
            store.addFreeResult(winners[0]);
            this.onDrawComplete?.('', winners);
            this.sphere?.setNames(store.getState().candidates);
          }, 300);
        },
        { 
          extraRevs: settings.extraRevs,
          durationMs: Math.max(2200, plan.decelerationDuration + 600),
          finalPauseMs: 1200
        }
      );
    }, DRAW_DELAY);
  }
}
