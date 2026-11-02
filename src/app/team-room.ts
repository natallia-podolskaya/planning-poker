import { TeamRoomMarker } from './types';

/** localStorage key: "this browser belongs to a member of a team room". */
export const TEAM_ROOM_KEY = 'poker_teamRoom';

export function readTeamRoomMarker(): TeamRoomMarker | null {
  try {
    const raw = localStorage.getItem(TEAM_ROOM_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw);
    return marker?.roomId && marker?.name ? marker : null;
  } catch {
    return null;
  }
}

export function saveTeamRoomMarker(marker: TeamRoomMarker) {
  localStorage.setItem(TEAM_ROOM_KEY, JSON.stringify(marker));
}

export function clearTeamRoomMarker() {
  localStorage.removeItem(TEAM_ROOM_KEY);
}
