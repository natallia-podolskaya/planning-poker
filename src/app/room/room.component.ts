import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../socket.service';
import { Member, RoomState } from '../types';
import { VotedCountPipe } from '../voted-count.pipe';
import { Subscription } from 'rxjs';

const CARDS = ['1', '2', '3', '5', '8', '13', '21', '34', '?', '☕'];

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, VotedCountPipe],
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss'
})
export class RoomComponent implements OnInit, OnDestroy {
  @Input() roomState!: RoomState;
  @Output() roomUpdated = new EventEmitter<RoomState>();
  @Output() left = new EventEmitter<void>();

  cards = CARDS;
  selectedCard: string | null = null;
  private sub!: Subscription;

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    this.sub = this.socketService.on<RoomState>('room-updated').subscribe((state) => {
      // Reset selection when SM resets the room
      if (!state.revealed && this.roomState.revealed) {
        this.selectedCard = null;
      }
      this.roomState = state;
      this.roomUpdated.emit(state);
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  get isSm(): boolean {
    return this.roomState.smSocketId === this.socketService.socketId;
  }

  get allVoted(): boolean {
    return this.roomState.members.every((m) => m.voted);
  }

  vote(value: string) {
    if (this.roomState.revealed) return;
    this.selectedCard = value;
    this.socketService.emit('vote', { roomId: this.roomState.roomId, value });
  }

  flipCards() {
    this.socketService.emit('flip-cards', { roomId: this.roomState.roomId });
  }

  resetRoom() {
    this.selectedCard = null;
    this.socketService.emit('reset-room', { roomId: this.roomState.roomId });
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

  trackBySocket(_: number, m: Member) { return m.socketId; }
}
