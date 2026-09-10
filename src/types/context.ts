import type { Room } from './room';

/** Room context state and actions exposed to consumers via useRoomContext(). */
export interface RoomContextValue {
  rooms: Room[];
  loading: boolean;
  adults: string;
  setAdults: (value: string) => void;
  kids: string;
  setKids: (value: string) => void;
  checkIn: Date | null;
  setCheckIn: (date: Date | null) => void;
  checkOut: Date | null;
  setCheckOut: (date: Date | null) => void;
  handleCheck: (e: React.FormEvent) => void;
  resetRoomFilterData: () => void;
}
