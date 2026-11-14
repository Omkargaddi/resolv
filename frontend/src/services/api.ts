import axios, { AxiosError } from 'axios';
import {
  AuthTokens,
  User,
  Venue,
  Slot,
  Booking,
  QueueStats,
} from '../types';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const API_BASE = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export function extractApiError(err: unknown): { message: string; code?: string; status?: number } {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorResponse>;
    const status = axiosErr.response?.status;
    const code = axiosErr.response?.data?.code;
    const message = axiosErr.response?.data?.error || axiosErr.message;
    return { message, code, status };
  }
  return { message: (err as Error).message || 'Unknown network error' };
}

// ── Auth API ───────────────────────────────────────────────────────────
export async function loginApi(email: string, password: string): Promise<AuthTokens> {
  const res = await apiClient.post<AuthTokens>('/auth/login', { email, password });
  return res.data;
}

export async function registerApi(
  name: string,
  email: string,
  password: string,
  phone?: string
): Promise<AuthTokens> {
  const res = await apiClient.post<AuthTokens>('/auth/register', {
    name,
    email,
    password,
    phone,
  });
  return res.data;
}

export async function getMeApi(token: string): Promise<User> {
  const res = await apiClient.get<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ── Venues & Slots API ──────────────────────────────────────────────────
export async function getVenuesApi(): Promise<Venue[]> {
  const res = await apiClient.get<Venue[]>('/venues');
  return res.data;
}

export async function getSlotsApi(venueId: string, date: string): Promise<Slot[]> {
  const res = await apiClient.get<Slot[]>(`/venues/${venueId}/slots`, {
    params: { date },
  });
  return res.data;
}

export async function getSlotByIdApi(slotId: string): Promise<Slot> {
  const res = await apiClient.get<Slot>(`/slots/${slotId}`);
  return res.data;
}

export async function blockSlotApi(
  token: string,
  slotId: string,
  reason: string = 'Administrative hold'
): Promise<Slot> {
  const res = await apiClient.post<Slot>(
    `/slots/${slotId}/block`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

export async function unblockSlotApi(token: string, slotId: string): Promise<Slot> {
  const res = await apiClient.post<Slot>(
    `/slots/${slotId}/unblock`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

// ── Bookings API ────────────────────────────────────────────────────────
export interface CreateBookingPayload {
  slotId: string;
  venueId: string;
  guestCount: number;
  notes?: string;
}

export async function createBookingApi(
  token: string,
  payload: CreateBookingPayload
): Promise<Booking> {
  const res = await apiClient.post<Booking>('/bookings', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getMyBookingsApi(
  token: string,
  status?: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ data: Booking[]; pagination: { total: number } }> {
  const res = await apiClient.get<{ data: Booking[]; pagination: { total: number } }>(
    '/bookings/my',
    {
      params: { status, limit, offset },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.data;
}

export async function getBookingByIdApi(token: string, bookingId: string): Promise<Booking> {
  const res = await apiClient.get<Booking>(`/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getBookingByCodeApi(token: string, code: string): Promise<Booking> {
  const res = await apiClient.get<Booking>(`/bookings/code/${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function cancelBookingApi(
  token: string,
  bookingId: string,
  reason: string = 'User requested cancellation'
): Promise<Booking> {
  const res = await apiClient.post<Booking>(
    `/bookings/${bookingId}/cancel`,
    { reason },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

// ── Admin & Queue API ───────────────────────────────────────────────────
export async function getQueueStatsApi(token: string): Promise<QueueStats> {
  const res = await apiClient.get<QueueStats>('/admin/queue-stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function getHealthApi(): Promise<{ status: string; uptime: number; timestamp: string }> {
  const res = await axios.get('/health');
  return res.data;
}
