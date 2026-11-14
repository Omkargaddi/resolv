export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  timezone: string;
  capacity: number;
  isActive: boolean;
}

export type SlotStatus = 'available' | 'booked' | 'blocked' | 'held';

export interface Slot {
  id: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remainingCapacity: number;
  status: SlotStatus;
  durationMinutes: number;
  price?: number;
  currency: string;
  metadata?: {
    blockReason?: string;
    blockedBy?: string;
    [key: string]: unknown;
  };
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  userId: string;
  slotId: string;
  venueId: string;
  confirmationCode: string;
  status: BookingStatus;
  guestCount: number;
  notes?: string;
  bookingDate: string;
  totalPrice?: number;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  slot?: Slot;
  user?: User;
}

export interface WebSocketEvent<T = unknown> {
  event: 'slotAvailabilityChanged' | 'bookingStatusChanged' | string;
  payload: T;
  timestamp: string;
}

export interface SlotAvailabilityPayload {
  slotId: string;
  venueId: string;
  status: SlotStatus;
  remainingCapacity: number;
}

export interface BookingStatusPayload {
  bookingId: string;
  status: BookingStatus;
  confirmationCode: string;
  userId: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface EdgeCaseTestResult {
  id: string;
  title: string;
  scenario: string;
  expectedStatus: number;
  actualStatus?: number;
  expectedCode: string;
  actualCode?: string;
  success?: boolean;
  message?: string;
  timestamp: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface Persona {
  id: 'user1' | 'user2' | 'admin';
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatarColor: string;
}
