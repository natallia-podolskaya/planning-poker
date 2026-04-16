import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import lottie, { AnimationItem } from 'lottie-web';
import { Subscription } from 'rxjs';
import { SocketService } from '../socket.service';
import { RoomState } from '../types';
import { ThemePickerComponent } from '../theme-picker/theme-picker.component';
import { ThemeService } from '../theme.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ThemePickerComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @Output() roomJoined = new EventEmitter<RoomState>();
  @ViewChild('lottieContainer') lottieContainer!: ElementRef;

  name = '';
  roomId = '';
  error = '';
  loading = false;

  private animation: AnimationItem | null = null;
  private animationData: any = null;
  private themeSub?: Subscription;

  constructor(private socketService: SocketService, private themeService: ThemeService) {
    this.socketService.on<RoomState>('room-created').subscribe((state) => {
      this.loading = false;
      this.roomJoined.emit(state);
    });

    this.socketService.on<RoomState>('room-joined').subscribe((state) => {
      this.loading = false;
      this.roomJoined.emit(state);
    });

    this.socketService.on<{ message: string }>('error').subscribe(({ message }) => {
      this.loading = false;
      this.error = message;
    });
  }

  async ngAfterViewInit() {
    this.animationData = await fetch('assets/animations/cards.json').then(r => r.json());
    this.mountAnimation();
    this.themeSub = this.themeService.theme$.subscribe(() => this.mountAnimation());
  }

  ngOnDestroy() {
    this.animation?.destroy();
    this.themeSub?.unsubscribe();
  }

  private mountAnimation() {
    if (!this.animationData || !this.lottieContainer) return;
    this.animation?.destroy();
    const data = JSON.parse(JSON.stringify(this.animationData));
    const colors = [
      this.readCssColor('--anim-card-1'),
      this.readCssColor('--anim-card-2'),
      this.readCssColor('--anim-card-3'),
    ];
    data.layers.forEach((layer: any, i: number) => {
      const fill = layer.shapes?.[0]?.it?.find((it: any) => it.ty === 'fl');
      if (fill && colors[i]) fill.c.k = colors[i];
    });
    this.animation = lottie.loadAnimation({
      container: this.lottieContainer.nativeElement,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: data,
    });
  }

  private readCssColor(varName: string): [number, number, number, number] | null {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return null;
    const hex = raw.replace('#', '');
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b, 1];
  }

  createRoom() {
    if (!this.name.trim()) { this.error = 'Please enter your name.'; return; }
    this.error = '';
    this.loading = true;
    sessionStorage.setItem('poker_session', JSON.stringify({ name: this.name.trim() }));
    this.socketService.emit('create-room', { name: this.name.trim(), userId: this.socketService.userId });
  }

  joinRoom() {
    if (!this.name.trim()) { this.error = 'Please enter your name.'; return; }
    if (!this.roomId.trim()) { this.error = 'Please enter a room ID.'; return; }
    this.error = '';
    this.loading = true;
    sessionStorage.setItem('poker_session', JSON.stringify({ name: this.name.trim() }));
    this.socketService.emit('join-room', { roomId: this.roomId.trim().toUpperCase(), name: this.name.trim(), userId: this.socketService.userId });
  }
}
