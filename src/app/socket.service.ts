import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io(window.location.origin, { path: '/socket.io' });
  }

  emit(event: string, data?: any) {
    this.socket.emit(event, data);
  }

  on<T>(event: string): Observable<T> {
    return new Observable((observer) => {
      this.socket.on(event, (data: T) => observer.next(data));
      return () => this.socket.off(event);
    });
  }

  get socketId(): string {
    return this.socket.id ?? '';
  }
}
