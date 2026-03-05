import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket;
  readonly userId: string;

  constructor() {
    this.userId = this.getOrCreateUserId();
    this.socket = io(window.location.origin, { path: '/socket.io' });
  }

  private getOrCreateUserId(): string {
    let id = localStorage.getItem('poker_userId');
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('poker_userId', id);
    }
    return id;
  }

  emit(event: string, data?: any) {
    this.socket.emit(event, data);
  }

  on<T>(event: string): Observable<T> {
    return new Observable((observer) => {
      const handler = (data: T) => observer.next(data);
      this.socket.on(event, handler);
      return () => this.socket.off(event, handler);
    });
  }

  onReconnect(): Observable<void> {
    return new Observable((observer) => {
      const handler = () => observer.next();
      this.socket.io.on('reconnect', handler);
      return () => this.socket.io.off('reconnect', handler);
    });
  }

  get socketId(): string {
    return this.socket.id ?? '';
  }
}
