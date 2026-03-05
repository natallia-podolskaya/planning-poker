export interface Member {
  userId: string;
  name: string;
  voted: boolean;
  vote: string | null;
}

export interface RoomState {
  roomId: string;
  smUserId: string;
  revealed: boolean;
  members: Member[];
}
