import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../socket.service';
import { Member, RoomState } from '../types';
import { VotedCountPipe } from '../voted-count.pipe';
import { Subscription } from 'rxjs';
import { ThemePickerComponent } from '../theme-picker/theme-picker.component';

const CARDS = ['1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'];

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, VotedCountPipe, ThemePickerComponent],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  @Input() roomState!: RoomState;
  @Output() roomUpdated = new EventEmitter<RoomState>();
  @Output() left = new EventEmitter<void>();

  cards = CARDS;
  selectedCard: string | null = null;
  copied = false;
  private sub!: Subscription;
  private copiedTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    // Restore local card selection after a server restart
    if (!this.roomState.revealed) {
      const raw = sessionStorage.getItem('poker_session');
      if (raw) {
        const { vote } = JSON.parse(raw);
        if (vote) this.selectedCard = vote;
      }
    }
    // SM starts with ☕ pre-selected if no previous selection
    if (this.isSm && !this.selectedCard) {
      this.selectedCard = '☕';
      this.persistVote('☕');
    }

    this.sub = this.socketService.on<RoomState>('room-updated').subscribe((state) => {
      // Reset selection when SM resets the room
      if (!state.revealed && this.roomState.revealed) {
        this.selectedCard = this.isSm ? '☕' : null;
        this.persistVote(this.selectedCard);
      }
      this.roomState = state;
      this.roomUpdated.emit(state);
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
  }

  copyRoomId() {
    navigator.clipboard.writeText(this.roomState.roomId).then(() => {
      this.copied = true;
      if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
      this.copiedTimeout = setTimeout(() => { this.copied = false; }, 5000);
    });
  }

  get isSm(): boolean {
    return this.roomState.smUserId === this.socketService.userId;
  }

  get allVoted(): boolean {
    return this.roomState.members.every((m) => m.voted);
  }

  vote(value: string) {
    if (this.roomState.revealed) return;
    this.selectedCard = value;
    this.persistVote(value);
    this.socketService.emit('vote', { roomId: this.roomState.roomId, value });
  }

  flipCards() {
    this.socketService.emit('flip-cards', { roomId: this.roomState.roomId });
  }

  resetRoom() {
    this.selectedCard = '☕';
    this.persistVote('☕');
    this.socketService.emit('reset-room', { roomId: this.roomState.roomId });
  }

  private persistVote(vote: string | null) {
    const raw = sessionStorage.getItem('poker_session');
    if (raw) {
      sessionStorage.setItem('poker_session', JSON.stringify({ ...JSON.parse(raw), vote }));
    }
  }

  leaveRoom() {
    this.left.emit();
  }

  average(): string {
    const numeric = this.roomState.members
      .map((m) => parseFloat(m.vote ?? ''))
      .filter((v) => !isNaN(v));
    if (!numeric.length) return '—';
    return (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1);
  }

  trackBySocket(_: number, m: Member) { return m.userId; }
}
