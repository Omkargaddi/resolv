<p align="center">
  <h1 align="center">Resolv</h1>
  <p align="center">A high-performance, real-time booking and reservation system built for scale.</p>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node.js" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/REST-API-005571?style=flat-square" alt="REST API" /></a>
  <a href="#"><img src="https://img.shields.io/badge/WebSockets-ws-010101?style=flat-square" alt="WebSockets" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Redis-7.x-DC382D?style=flat-square&logo=redis" alt="Redis" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" /></a>
  <a href="#"><img src="https://img.shields.io/badge/AWS-Integrated-FF9900?style=flat-square&logo=amazonaws" alt="AWS" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" /></a>
</p>

---

## Overview

Reslov is a production-grade reservation engine designed to handle high-concurrency booking scenarios with zero double-booking guarantees. It leverages Redis distributed locks, PostgreSQL row-level locking, and event-driven architecture to ensure data integrity under heavy load.

Built as a set of composable services behind a clean Express REST API with native WebSocket event broadcasting, Resolv supports multi-tenant venue management, flexible time-slot configurations, and real-time availability updates.

## Features

- **Real-time Booking Engine** -- Optimistic locking with Redis + PostgreSQL to prevent double bookings under concurrent access
- **RESTful API** -- Clean, organized endpoints under `/api` for authentication, venues, slots, and bookings
- **Real-Time WebSockets** -- Native WebSocket broadcasting at `/ws` for slot availability and booking status changes
- **Queue-Based Processing** -- BullMQ workers for async booking confirmation, email dispatch, and slot reclamation
- **Push Notifications** -- AWS SNS integration for booking confirmations, reminders, and cancellation alerts
- **Rate Limiting** -- Token-bucket rate limiting backed by Redis for abuse prevention
- **JWT Authentication** -- Stateless auth with refresh token rotation and role-based access control
- **Multi-Venue Support** -- Manage multiple venues with independent availability calendars and slot configurations
- **Automatic Slot Reclamation** -- Expired holds are released back into the pool via scheduled workers
- **Observability** -- Structured JSON logging with Winston, request tracing, and health check endpoints

## Architecture

```
                                    +------------------+
                                    |   Client Apps    |
                                    |  (Web / Mobile)  |
                                    +--------+---------+
                                             |
                                         WebSocket / HTTPS
                                             |
                                    +--------v---------+
                                    |   REST Gateway   |
                                    |   & WebSockets   |
                                    +--+-----+------+--+
                                       |     |      |
                          +------------+     |      +-------------+
                          |                  |                    |
                  +-------v------+   +------v-------+   +-------v--------+
                  |   Auth       |   |  Booking     |   |  Notification  |
                  |  Middleware  |   |  Service     |   |  Service       |
                  +--------------+   +--+--------+--+   +-------+--------+
                                        |        |              |
                                   +----v--+ +---v----+   +----v-----+
                                   |  PG   | | Redis  |   |  AWS SNS |
                                   +-------+ +--------+   +----------+
                                                |
                                          +-----v------+
                                          |   BullMQ   |
                                          |   Workers  |
                                          +------------+
```

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Runtime        | Node.js 20, TypeScript 5.3          |
| API            | Express 4 (REST)                    |
| Real-Time      | WebSockets (ws)                     |
| Database       | PostgreSQL 16, TypeORM              |
| Cache / Locks  | Redis 7 (ioredis)                   |
| Queue          | BullMQ                              |
| Auth           | JWT (jsonwebtoken), bcryptjs        |
| Notifications  | AWS SNS                             |
| Containerization | Docker, Docker Compose            |
| Logging        | Winston                             |

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Docker & Docker Compose
- AWS credentials (for notification features)

### Installation

```bash
# Clone the repository
git clone https://github.com/nicolaslumbert/reserve-api.git
cd reserve-api

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# Seed initial test data (Users and Slots)
npm run seed

# Start the development server
npm run dev
```

The REST API will be available at `http://localhost:4000/api` and WebSockets at `ws://localhost:4000/ws`.

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

#### Cancel a Booking
`POST /api/bookings/:id/cancel`
*Header: `Authorization: Bearer <accessToken>`*
```json
{
  "reason": "Schedule conflict"
}
```

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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled production build |
| `npm test` | Run test suite |
| `npm run seed` | Seed database with demo users and slots |
| `npm run lint` | Lint source files |
| `npm run docker:up` | Start all services via Docker Compose |

## License

MIT
