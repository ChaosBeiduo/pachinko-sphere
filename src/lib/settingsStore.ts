import type { SphereSettings } from './types';

const SETTINGS_KEY = 'appSettings.v1';

export const DEFAULT_SETTINGS: SphereSettings = {
  rotationSpeed: 0.2, // rad/s
  spinTurns: 3,
  spinDuration: 5,    // s
  extraRevs: 6,
};

type SettingsListener = (settings: SphereSettings) => void;

class SettingsStore {
  private settings: SphereSettings;
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): SphereSettings {
    if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
    
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;

    try {
      const parsed = JSON.parse(saved);
      return this.validateSettings(parsed);
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  private validateSettings(data: any): SphereSettings {
    const settings = { ...DEFAULT_SETTINGS };

    if (typeof data.rotationSpeed === 'number' && data.rotationSpeed >= 0.1 && data.rotationSpeed <= 10) {
      settings.rotationSpeed = data.rotationSpeed;
    }
    if (typeof data.spinTurns === 'number' && data.spinTurns >= 1 && data.spinTurns <= 100) {
      settings.spinTurns = data.spinTurns;
    }
    if (typeof data.spinDuration === 'number' && data.spinDuration >= 1 && data.spinDuration <= 60) {
      settings.spinDuration = data.spinDuration;
    }
    if (typeof data.extraRevs === 'number' && data.extraRevs >= 0 && data.extraRevs <= 200) {
      settings.extraRevs = data.extraRevs;
    }

    return settings;
  }

  getSettings(): SphereSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<SphereSettings>) {
    this.settings = this.validateSettings({ ...this.settings, ...newSettings });
    this.persist();
    this.notify();
  }

  resetToDefault() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.persist();
    this.notify();
  }

  private persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }
  }

  subscribe(listener: SettingsListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.settings));
  }
}

export const settingsStore = new SettingsStore();
