import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { RoomComponent } from './room/room.component';
import { RoomState } from './types';
import { SocketService } from './socket.service';
import { Subscription } from 'rxjs';

const SESSION_KEY = 'poker_session';
const RETRY_DELAY = 3_000;
const MAX_RETRIES = 10;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HomeComponent, RoomComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  roomState: RoomState | null = null;
  reconnecting = false;

  private subs = new Subscription();
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private retryCount = 0;

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    // Re-join after a network drop (socket reconnects without page refresh)
    this.subs.add(
      this.socketService.onReconnect().subscribe(() => this.tryRejoinFromSession(true))
    );

    // Handle room-joined while already in a room, or while reconnecting after server restart
    this.subs.add(
      this.socketService.on<RoomState>('room-joined').subscribe((state) => {
        if (this.roomState !== null || this.reconnecting) {
          this.stopRetry();
          this.roomState = state;
          this.updateSession(state);
          this.reVoteIfNeeded(state);
        }
        // If roomState is null and not reconnecting, HomeComponent handles it
      })
    );

    // Handle retryable errors (room not found while server is still restarting)
    this.subs.add(
      this.socketService.on<{ message: string; retryable?: boolean }>('error').subscribe(({ retryable }) => {
        if (retryable && sessionStorage.getItem(SESSION_KEY)) {
          this.startRetry();
        }
      })
    );

    // On page load, attempt to restore session (covers page refresh case)
    this.tryRejoinFromSession();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.stopRetry();
  }

  private tryRejoinFromSession(isSocketReconnect = false) {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const { roomId, name, isSM, vote, revealed } = JSON.parse(raw);
    if (roomId && name) {
      this.reconnecting = true;
      // isSM room-recreation is only safe on actual socket reconnect (network drop or server restart).
      // On a fresh page load we never recreate — avoids phantom rooms with wrong SM.
      this.socketService.emit('join-room', {
        roomId, name, userId: this.socketService.userId,
        isSM: isSocketReconnect && !!isSM,
        vote: vote ?? null,
        revealed: !!revealed,
      });
    }
  }

  private startRetry() {
    if (this.retryTimer) return; // already retrying
    this.reconnecting = true;
    this.retryCount = 0;
    this.retryTimer = setInterval(() => {
      if (this.retryCount >= MAX_RETRIES) {
        this.stopRetry();
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      this.retryCount++;
      this.tryRejoinFromSession();
    }, RETRY_DELAY);
  }

  private stopRetry() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    this.reconnecting = false;
    this.retryCount = 0;
  }

  private updateSession(state: RoomState) {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    session.roomId = state.roomId;
    session.isSM = state.smUserId === this.socketService.userId;
    session.revealed = state.revealed;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private reVoteIfNeeded(state: RoomState) {
    if (state.revealed) return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const { vote } = JSON.parse(raw);
    if (vote) {
      this.socketService.emit('vote', { roomId: state.roomId, value: vote });
    }
  }

  onRoomJoined(state: RoomState) {
    this.roomState = state;
    this.updateSession(state);
  }

  onRoomUpdated(state: RoomState) {
    this.roomState = state;
    this.updateSession(state);
  }

  onLeft() {
    sessionStorage.removeItem(SESSION_KEY);
    this.stopRetry();
    this.roomState = null;
  }
}
