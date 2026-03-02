import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../socket.service';
import { RoomState } from '../types';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  @Output() roomJoined = new EventEmitter<RoomState>();

  name = '';
  roomId = '';
  error = '';
  loading = false;

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

  createRoom() {
    if (!this.name.trim()) { this.error = 'Please enter your name.'; return; }
    this.error = '';
    this.loading = true;
    this.socketService.emit('create-room', { name: this.name.trim() });
  }

  joinRoom() {
    if (!this.name.trim()) { this.error = 'Please enter your name.'; return; }
    if (!this.roomId.trim()) { this.error = 'Please enter a room ID.'; return; }
    this.error = '';
    this.loading = true;
    this.socketService.emit('join-room', { roomId: this.roomId.trim().toUpperCase(), name: this.name.trim() });
  }
}
