# Resolv

<p align="center">
  <img width="866" height="288" alt="Resolv" src="https://github.com/user-attachments/assets/d1eaaa77-c2de-43d7-a463-b5041a643196" />
</p>

<p align="center">
  <strong>A scalable reservation platform built for reliable booking and real-time availability.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go" alt="Go" />
  <img src="https://img.shields.io/badge/Router-Chi-blue?style=flat-square" alt="Chi" />
  <img src="https://img.shields.io/badge/API-REST-005571?style=flat-square" alt="REST API" />
  <img src="https://img.shields.io/badge/WebSockets-Gorilla-010101?style=flat-square" alt="WebSockets" />
  <img src="https://img.shields.io/badge/Redis-7.x-DC382D?style=flat-square&logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

## Introduction

Resolv is a high-throughput reservation backend built to manage bookings reliably, even when multiple users compete for the same availability.

Its booking engine combines Redis-based distributed locking with PostgreSQL transaction controls, including row-level locks (`SELECT ... FOR UPDATE`) and serializable transactions. These mechanisms coordinate concurrent booking requests and protect against double bookings.

The platform is implemented in Go using Chi, pgx, Redis, and Asynq. It provides a REST API, live WebSocket updates, background task processing, and support for managing multiple venues with independently configured availability schedules.

## Platform Capabilities

- **Concurrency-safe reservations:** Coordinates competing booking requests through Redis distributed locks and PostgreSQL locking mechanisms.
- **Venue and availability management:** Supports multiple venues, configurable time slots, and independent availability calendars.
- **REST API:** Exposes structured endpoints for authentication, venue operations, slot management, and reservations.
- **Live updates:** Broadcasts booking and slot availability changes to connected clients through WebSockets.
- **Background execution:** Uses Asynq workers backed by Redis for asynchronous confirmations, notifications, and reservation-related tasks.
- **Authentication and authorization:** Provides JWT-based authentication, refresh token rotation, and role-based access control.
- **Reservation lifecycle management:** Handles booking creation, cancellation, status changes, and automatic release of expired holds.
- **Operational visibility:** Includes structured application logs, request tracing, and health-check endpoints.

## System Design

Resolv separates HTTP request handling, reservation logic, persistence, and asynchronous processing into dedicated components.

```text
                       +----------------------+
                       |     Client Apps      |
                       |   React + Vite UI    |
                       +----------+-----------+
                                  |
                           HTTPS / WebSocket
                                  |
                       +----------v-----------+
                       |    Go API Gateway   |
                       |   Chi + WebSockets  |
                       +----------+-----------+
                                  |
                 +----------------+----------------+
                 |                |                |
          +------v------+  +------v-------+  +-----v---------+
          | Authentication| | Reservation  |  | Notification  |
          |   Middleware  | |   Service    |  |   Service     |
          +--------------+ +------+-------+  +---------------+
                                  |
                         +--------+--------+
                         |                 |
                  +------v------+   +------v------+
                  | PostgreSQL  |   |    Redis    |
                  | Persistence |   | Locks/Queue |
                  +-------------+   +------+------+
                                          |
                                    +-----v------+
                                    | Asynq      |
                                    | Background |
                                    | Workers    |
                                    +------------+
```

### Booking consistency

Reservation requests pass through multiple protection layers:

1. **Redis distributed locks** coordinate access to shared booking resources across concurrent requests.
2. **PostgreSQL row-level locking** protects records during critical database operations.
3. **Serializable transactions** provide an additional layer of transaction isolation.
4. **Asynchronous workers** handle tasks that do not need to execute in the initial HTTP request, including notifications and scheduled reservation cleanup.

Together, these mechanisms are designed to preserve booking integrity under high concurrency.

## Technology Stack

| Component | Technology |
|---|---|
| Backend language | Go 1.22+ |
| HTTP routing | Chi |
| Real-time communication | Gorilla WebSocket |
| Database | PostgreSQL 16 |
| Database driver | pgx |
| Distributed locking and caching | Redis 7 |
| Background jobs | Asynq |
| Authentication | JWT and bcrypt |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Deployment | Docker and Docker Compose |

## Getting Started

### Requirements

Before running Resolv locally, make sure the following tools are available:

- Go 1.22 or later
- Node.js 18 or later
- Docker
- Docker Compose

### 1. Get the source code

```bash
git clone https://github.com/Omkargaddi/resolv.git
cd resolv
```

### 2. Configure environment variables

Create your local environment file from the supplied example:

```bash
cp .env.example .env
```

Update the environment values as needed for your local database, Redis instance, and application configuration.

### 3. Launch infrastructure services

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d postgres redis
```

### 4. Initialize the database

Populate the database with the initial users, admin account, venue data, and a seven-day availability schedule:

```bash
npm run backend:seed
```

Alternatively, execute the seed command directly from the backend directory:

```bash
cd backend
go run ./cmd/seed
cd ..
```

### 5. Run the backend

Start the Go API server:

```bash
npm run backend:dev
```

Or run it directly:

```bash
cd backend
go run ./cmd/server
```

### 6. Start the frontend

Open another terminal at the project root and run:

```bash
npm run frontend:dev
```

### Local endpoints

| Service | Address |
|---|---|
| REST API | `http://localhost:4000/api` |
| WebSocket endpoint | `ws://localhost:4000/ws` |
| Frontend | `http://localhost:3000` |

---

## API Reference

All REST endpoints are grouped under `/api`. Protected routes require a valid access token in the `Authorization` header.

```http
Authorization: Bearer <access-token>
```

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create a user account |
| `POST` | `/api/auth/login` | Authenticate a user |
| `POST` | `/api/auth/refresh` | Obtain a new access token |
| `GET` | `/api/auth/me` | Retrieve the authenticated user's profile |

**Register**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "phone": "+1234567890"
}
```

**Login**

```json
{
  "email": "user@example.com",
  "password": "securepass"
}
```

**Refresh access token**

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Venue and Slot Management

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/venues/:venueId/slots?date=2026-11-15` | List available slots for a venue and date |
| `GET` | `/api/slots/:id` | Retrieve slot details |
| `POST` | `/api/slots/:id/block` | Block a slot (Admin) |
| `POST` | `/api/slots/:id/unblock` | Restore a blocked slot (Admin) |

**Block a slot**

```json
{
  "reason": "Maintenance"
}
```

Administrative operations require an admin access token.

### Reservation Management

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/bookings` | Create a reservation |
| `GET` | `/api/bookings/my?limit=20&offset=0` | List the current user's reservations |
| `GET` | `/api/bookings/:id` | Retrieve a reservation by ID |
| `GET` | `/api/bookings/code/:code` | Find a reservation using its confirmation code |
| `POST` | `/api/bookings/:id/cancel` | Cancel an existing reservation |

**Create a reservation**

```json
{
  "slotId": "slot-uuid",
  "venueId": "venue-uuid",
  "guestCount": 2,
  "notes": "Window seat preferred"
}
```

**Cancel a reservation**

```json
{
  "reason": "Schedule conflict"
}
```

These endpoints require an authenticated user unless otherwise specified by the application.

### Administration

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/queue-stats` | View background task queue statistics |

This endpoint is restricted to administrators.

---

## Real-Time Communication

Resolv provides a WebSocket endpoint for clients that need immediate updates without repeatedly polling the REST API.

Connect to:

```text
ws://localhost:4000/ws
```

The server broadcasts JSON events when relevant reservation or availability state changes.

### Availability update

Emitted when a slot's availability changes.

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

### Reservation status update

Emitted when a reservation changes state.

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

Clients can use these events to keep availability indicators and reservation status synchronized with the backend.

## Background Processing

Long-running and scheduled operations are handled outside the main HTTP request flow.

Resolv uses **Asynq with Redis** to process background tasks such as:

- Reservation confirmation workflows
- Notification dispatch
- Booking reminders
- Cancellation-related notifications
- Automatic cleanup of expired reservation holds

Recurring workers help return expired holds to the available slot pool.

## Development Commands

The following scripts are available from the project root:

| Command | Description |
|---|---|
| `npm run backend:dev` | Start the Go backend in development mode |
| `npm run backend:seed` | Insert initial application and venue data |
| `npm run backend:test` | Execute backend tests |
| `npm run backend:build` | Compile the backend into `bin/server` |
| `npm run frontend:dev` | Start the frontend development server |
| `npm run frontend:build` | Build the frontend for production |
| `npm run docker:up` | Start the Docker Compose services |
| `npm run docker:down` | Stop the Docker Compose services |

## Health and Observability

Resolv includes operational endpoints and logging facilities to help monitor the service:

- **Health checks:** `/health` provides an endpoint for service health monitoring.
- **Structured logging:** Application events are recorded in a structured format.
- **Request tracing:** Request-level tracing helps follow application activity.
- **Queue statistics:** Administrators can inspect background task queue information through the admin API.

