import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly storageKey = 'theme-preference';

    readonly themeMode = signal<ThemeMode>(this.loadTheme());

    constructor() {
        this.applyTheme();
    }

    setTheme(mode: ThemeMode): void {
        this.themeMode.set(mode);
        localStorage.setItem(this.storageKey, mode);
        this.applyTheme();
    }

    private loadTheme(): ThemeMode {
        const stored = localStorage.getItem(this.storageKey);
        if (stored === 'light' || stored === 'dark') return stored;
        return 'system';
    }

    private applyTheme(): void {
        const html = document.documentElement;
        const mode = this.themeMode();
        if (mode === 'system') {
            html.removeAttribute('data-theme');
        } else {
            html.setAttribute('data-theme', mode);
        }
    }
}
