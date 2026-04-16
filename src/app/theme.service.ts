import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeId = 'midnight' | 'ocean' | 'forest' | 'sunset' | 'light';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  swatchBg: string;
  swatchAccent: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'midnight', name: 'Midnight', swatchBg: '#1a1a2e', swatchAccent: '#6366f1' },
  { id: 'ocean',    name: 'Ocean',    swatchBg: '#0c2740', swatchAccent: '#06b6d4' },
  { id: 'forest',   name: 'Forest',   swatchBg: '#13261f', swatchAccent: '#10b981' },
  { id: 'sunset',   name: 'Sunset',   swatchBg: '#2a1438', swatchAccent: '#f97316' },
  { id: 'light',    name: 'Light',    swatchBg: '#ffffff', swatchAccent: '#6366f1' },
];

const STORAGE_KEY = 'poker_theme';
const DEFAULT_THEME: ThemeId = 'midnight';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly current$ = new BehaviorSubject<ThemeId>(DEFAULT_THEME);

  readonly themes = THEMES;
  readonly theme$ = this.current$.asObservable();

  constructor() {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeId | null);
    const initial = saved && THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME;
    this.apply(initial);
  }

  get current(): ThemeId {
    return this.current$.value;
  }

  set(id: ThemeId) {
    if (!THEMES.some(t => t.id === id)) return;
    this.apply(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  private apply(id: ThemeId) {
    document.documentElement.setAttribute('data-theme', id);
    this.current$.next(id);
  }
}
