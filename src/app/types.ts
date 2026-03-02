export interface Member {
  socketId: string;
  name: string;
  voted: boolean;
  vote: string | null;
}

export interface RoomState {
  roomId: string;
  smSocketId: string;
  revealed: boolean;
  members: Member[];
}
