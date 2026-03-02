import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { RoomComponent } from './room/room.component';
import { RoomState } from './types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HomeComponent, RoomComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  roomState: RoomState | null = null;

  onRoomJoined(state: RoomState) {
    this.roomState = state;
  }

  onRoomUpdated(state: RoomState) {
    this.roomState = state;
  }

  onLeft() {
    this.roomState = null;
  }
}
