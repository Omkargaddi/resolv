<p align="center">
  <h1 align="center">Resolv</h1>
  <p align="center">A high-performance, real-time booking and reservation system built for scale.</p>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go" alt="Go" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Router-Chi-blue?style=flat-square" alt="Chi" /></a>
  <a href="#"><img src="https://img.shields.io/badge/REST-API-005571?style=flat-square" alt="REST API" /></a>
  <a href="#"><img src="https://img.shields.io/badge/WebSockets-Gorilla-010101?style=flat-square" alt="WebSockets" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Redis-7.x-DC382D?style=flat-square&logo=redis" alt="Redis" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
</p>

---

## Overview

Resolv is a production-grade reservation engine designed to handle high-concurrency booking scenarios with zero double-booking guarantees. It leverages Redis distributed locks, PostgreSQL row-level locking (`SELECT ... FOR UPDATE`), serializable transactions, and an event-driven architecture to ensure data integrity under heavy load.

Built as a high-throughput Go service using Chi, pgx, Asynq, and native WebSocket event broadcasting, Resolv supports multi-tenant venue management, flexible time-slot configurations, and real-time availability updates.

## Features

- **Real-time Booking Engine** -- Optimistic and distributed locking with Redis + PostgreSQL pessimistic locking (`FOR UPDATE`) to prevent double bookings under concurrent access
- **RESTful API** -- Clean, organized endpoints under `/api` for authentication, venues, slots, and bookings
- **Real-Time WebSockets** -- Native WebSocket broadcasting at `/ws` for slot availability and booking status changes powered by Gorilla WebSocket
- **Queue-Based Processing** -- Asynq Redis workers for async booking confirmation, notification dispatch, and slot reclamation
- **Event Notifications** -- Notification dispatch for booking confirmations, reminders, and cancellation alerts
- **JWT Authentication** -- Stateless auth with refresh token rotation and role-based access control
- **Multi-Venue Support** -- Manage multiple venues with independent availability calendars and slot configurations
- **Automatic Slot Reclamation** -- Expired holds released back into the pool via scheduled recurring workers
- **Observability** -- Structured logging, request tracing, and `/health` check endpoints

## Architecture

```
                                    +------------------+
                                    |   Client Apps    |
                                    | (Web - React Vite|
                                    +--------+---------+
                                             |
                                     WebSocket / HTTPS
                                             |
                                    +--------v---------+
                                    |  Go REST Gateway |
                                    |   & WebSockets   |
                                    +--+-----+------+--+
                                       |     |      |
                          +------------+     |      +-------------+
                          |                  |                    |
                  +-------v------+   +------v-------+   +-------v--------+
                  |   Auth       |   |  Booking     |   |  Notification  |
                  |  Middleware  |   |  Service     |   |  Service       |
                  +--------------+   +--+--------+--+   +----------------+
                                        |        |
                                   +----v--+ +---v----+
                                   |  PG   | | Redis  |
                                   +-------+ +--------+
                                                |
                                          +-----v------+
                                          |   Asynq    |
                                          |   Workers  |
                                          +------------+
```

## Tech Stack

| Layer            | Technology                                |
|------------------|-------------------------------------------|
| Backend Runtime  | Go 1.22+                                  |
| API Router       | Chi (`github.com/go-chi/chi/v5`)          |
| Real-Time        | Gorilla WebSocket (`gorilla/websocket`)   |
| Database         | PostgreSQL 16, pgx (`jackc/pgx/v5`)       |
| Cache / Locks    | Redis 7 (`redis/go-redis/v9`)             |
| Queue / Tasks    | Asynq (`hibiken/asynq`)                   |
| Auth             | JWT (`golang-jwt/jwt/v5`), bcrypt         |
| Notifications    | Internal Event / Logger Service           |
| Frontend         | React 19, TypeScript, Vite, TailwindCSS   |
| Containerization | Docker, Docker Compose                    |

---

## Quick Start

### Prerequisites

- Go >= 1.22
- Node.js >= 18 (for the frontend React client)
- Docker & Docker Compose

### Installation & Local Setup

```bash
# 1. Clone repository
git clone https://github.com/nicolaslumbert/reserve-api.git
cd reserve-api

# 2. Copy environment configuration
cp .env.example .env

# 3. Start database and cache infrastructure
docker-compose up -d postgres redis

# 4. Seed initial test data (Admin, users, and 7-day slot schedule)
npm run backend:seed
# Or directly:
cd backend && go run ./cmd/seed && cd ..

# 5. Start Go backend server
npm run backend:dev
# Or directly:
cd backend && go run ./cmd/server && cd ..

# 6. In a new terminal, start frontend dev server
npm run frontend:dev
```

The REST API will be available at `http://localhost:4000/api`, WebSockets at `ws://localhost:4000/ws`, and the frontend UI at `http://localhost:3000`.

---

## API Documentation

### Authentication

#### Register
`POST /api/auth/register`
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "phone": "+1234567890"
}
```

#### Login
`POST /api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "securepass"
}
```

#### Refresh Token
`POST /api/auth/refresh`
```json
{
  "refreshToken": "<refresh-token>"
}
```

#### Get Current Profile
`GET /api/auth/me`
*Header: `Authorization: Bearer <accessToken>`*

---

### Slots

#### Get Available Slots for a Venue
`GET /api/venues/:venueId/slots?date=2026-11-15`

#### Get Slot by ID
`GET /api/slots/:id`

#### Block Slot (Admin Only)
`POST /api/slots/:id/block`
*Header: `Authorization: Bearer <adminToken>`*
```json
{
  "reason": "Maintenance"
}
```

#### Unblock Slot (Admin Only)
`POST /api/slots/:id/unblock`
*Header: `Authorization: Bearer <adminToken>`*

---

### Bookings

#### Create a Booking
`POST /api/bookings`
*Header: `Authorization: Bearer <accessToken>`*
```json
{
  "slotId": "slot-uuid",
  "venueId": "venue-uuid",
  "guestCount": 2,
  "notes": "Window seat preferred"
}
```

#### Get My Bookings
`GET /api/bookings/my?limit=20&offset=0`
*Header: `Authorization: Bearer <accessToken>`*

#### Get Booking by ID
`GET /api/bookings/:id`
*Header: `Authorization: Bearer <accessToken>`*

#### Get Booking by Code
`GET /api/bookings/code/:code`
*Header: `Authorization: Bearer <accessToken>`*

#### Cancel a Booking
`POST /api/bookings/:id/cancel`
*Header: `Authorization: Bearer <accessToken>`*
```json
{
  "reason": "Schedule conflict"
}
```

---

### Admin & Queue

#### Get Queue Statistics (Admin Only)
`GET /api/admin/queue-stats`
*Header: `Authorization: Bearer <adminToken>`*

---

### Real-Time WebSocket Events

Connect to `ws://localhost:4000/ws`.

The server broadcasts JSON messages when slot availability or bookings change:

#### Slot Availability Changed
```json
{
  "event": "slotAvailabilityChanged",
  "payload": {
    "slotId": "uuid",
    "venueId": "uuid",
    "status": "available",
    "remainingCapacity": 2
  },
  "timestamp": "2026-11-14T06:00:00.000Z"
}
```

#### Booking Status Changed
```json
{
  "event": "bookingStatusChanged",
  "payload": {
    "bookingId": "uuid",
    "status": "confirmed",
    "confirmationCode": "RSV-08CF964C",
    "userId": "uuid"
  },
  "timestamp": "2026-11-14T06:00:00.000Z"
}
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run backend:dev` | Run Go backend server (`go run ./cmd/server`) |
| `npm run backend:seed` | Seed database with users and venue slots |
| `npm run backend:test` | Run Go unit and model tests |
| `npm run backend:build` | Build production Go binary to `bin/server` |
| `npm run frontend:dev` | Start frontend React/Vite development server |
| `npm run frontend:build` | Compile production frontend build |
| `npm run docker:up` | Start all services via Docker Compose |
| `npm run docker:down` | Stop Docker Compose services |

