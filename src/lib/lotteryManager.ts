import { store } from './store';
import { drawWinners } from './drawEngine';
import { modalManager } from './modalManager';
import { translations } from './i18n';
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
   * Includes validation, animation coordination, and state commitment
   */
  async startDraw() {
    const state = store.getState();
    if (state.isDrawing) return;

    const prize = state.prizes.find(p => p.id === state.currentPrizeId);
    if (!prize) return;

    // 1. Check for overwrite if this prize already has winners
    const existingWinners = state.results[prize.id];
    if (existingWinners && existingWinners.length > 0) {
      const confirmed = await modalManager.confirm(this.t('prizeOverwriteConfirm', { prize: prize.title }));
      if (!confirmed) return;

      // Rollback previous winners to candidates list
      const newCandidates = [...state.candidates, ...existingWinners];
      const newResults = { ...state.results };
      delete newResults[prize.id];

      store.setState({
        candidates: newCandidates,
        results: newResults
      });
      
      // Update sphere with rolled-back candidates
      this.sphere?.setNames(newCandidates);
    }

    const currentState = store.getState();
    if (currentState.candidates.length < prize.count) {
      modalManager.alert(this.t('insufficientCandidates', { 
        count: currentState.candidates.length, 
        needed: prize.count 
      }));
      return;
    }

    // 2. Prepare for drawing
    store.setDrawing(true);
    this.onDrawStart?.(prize.title);

    // 3. Coordination: Start Animation
    this.sphere?.spin();

    // 4. Logic: Calculate winners immediately (fairness is preserved as they are hidden)
    const { winners, remainingCandidates } = drawWinners(currentState.candidates, prize.count);

    // 5. Animation Timing: Stop and highlight winners after a suspenseful delay
    const DRAW_DELAY = 3000; 
    
    setTimeout(() => {
      this.sphere?.stopAndHighlightWinners(
        winners,
        (name) => {
          this.onWinnerHighlight?.(name);
        },
        () => {
          // 6. Completion: Update store and notify UI
          store.setDrawing(false);

          // Commit winners to store results
          const currentStoreState = store.getState();
          const finalResults = { ...currentStoreState.results, [prize.id]: winners };
          
          store.setState({
            candidates: remainingCandidates,
            results: finalResults
          });

          // Finalize UI
          this.onDrawComplete?.(prize.title, winners);
          
          // Sync sphere with remaining candidates for next round
          this.sphere?.setNames(remainingCandidates);
        }
      );
    }, DRAW_DELAY);
  }
}
