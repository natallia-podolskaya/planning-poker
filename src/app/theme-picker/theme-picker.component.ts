import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeId } from '../theme.service';

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-picker.component.html',
  styleUrl: './theme-picker.component.scss',
})
export class ThemePickerComponent {
  themes;
  current: ThemeId;

  constructor(private themeService: ThemeService) {
    this.themes = this.themeService.themes;
    this.current = this.themeService.current;
    this.themeService.theme$.subscribe(id => (this.current = id));
  }

  select(id: ThemeId) {
    this.themeService.set(id);
  }
}
