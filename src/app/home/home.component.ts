import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import lottie, { AnimationItem } from 'lottie-web';
import { SocketService } from '../socket.service';
import { RoomState } from '../types';
import { ThemePickerComponent } from '../theme-picker/theme-picker.component';

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

  private animation!: AnimationItem;

  constructor(private socketService: SocketService) {
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

  ngAfterViewInit() {
    this.animation = lottie.loadAnimation({
      container: this.lottieContainer.nativeElement,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'assets/animations/cards.json',
    });
  }

  ngOnDestroy() {
    this.animation?.destroy();
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
