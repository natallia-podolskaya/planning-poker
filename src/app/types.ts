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
  /** True for fixed team rooms that are auto-created and elect the SM by name. */
  isTeamRoom?: boolean;
}

/** Remembered membership of a team room, stored in localStorage. */
export interface TeamRoomMarker {
  roomId: string;
  name: string;
}
