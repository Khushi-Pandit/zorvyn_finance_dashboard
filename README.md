# Finance Data Processing & Access Control Backend

A production-grade REST API for a multi-role finance dashboard. Built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL**, and **Redis** — featuring JWT authentication, role-based access control, financial record management, aggregated analytics, and a full audit trail.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Quick Start](#4-quick-start)
5. [Environment Variables](#5-environment-variables)
6. [Project Structure](#6-project-structure)
7. [Data Model](#7-data-model)
8. [Authentication](#8-authentication)
9. [Role-Based Access Control](#9-role-based-access-control)
10. [API Reference](#10-api-reference)
11. [Request & Response Format](#11-request--response-format)
12. [Running Tests](#12-running-tests)
13. [API Documentation (Swagger)](#13-api-documentation-swagger)
14. [Assumptions & Design Decisions](#14-assumptions--design-decisions)
15. [Future Improvements](#15-future-improvements)

---

## 1. Project Overview

This backend powers a multi-role financial dashboard. Different users interact with financial records based on their role — Viewers can read, Analysts can analyse, and Admins can manage everything.

**Core capabilities:**

- JWT authentication with secure refresh-token rotation and reuse detection
- Three-tier RBAC enforced at the middleware layer on every route
- Full CRUD lifecycle for financial records with advanced filtering, search, sorting, and pagination
- Six dashboard / analytics endpoints — totals, trends, category breakdowns, comparisons
- Append-only audit log capturing every create / update / delete / login action
- Redis-cached aggregate queries with automatic cache invalidation on writes
- Soft deletes on users and records — nothing is ever physically removed
- Export records as JSON or CSV
- Rate limiting (global + auth-specific brute-force protection)
- Self-documenting OpenAPI 3.0 spec served via Swagger UI

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable async I/O, wide ecosystem |
| Language | TypeScript 5 | Compile-time safety critical for financial data |
| Framework | Express 4 | Mature, rich middleware ecosystem |
| ORM | Prisma 5 | Type-safe queries, first-class migration tooling |
| Database | PostgreSQL 16 | ACID compliance, exact DECIMAL arithmetic, window functions |
| Cache / Rate Limit | Redis 7 | Sub-ms dashboard reads, shared rate-limit state across processes |
| Validation | Zod | Schemas double as TypeScript types — no duplication |
| Auth | jsonwebtoken + bcryptjs | Industry-standard JWT + bcrypt (cost 12) |
| API Docs | swagger-jsdoc + swagger-ui-express | Auto-generated OpenAPI 3.0 spec |
| Testing | Jest + ts-jest | Unit tests with full mock isolation |
| Logging | Winston | Structured JSON in production, coloured in development |

---

## 3. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 20.11.0 | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| npm | >= 10 | Comes with Node 20 |
| Docker + Docker Compose | Any recent | Runs PostgreSQL and Redis locally |
| Git | Any | For cloning |

> **No local PostgreSQL or Redis installation needed** — Docker Compose handles both.

---

## 4. Quick Start

### Step 1 — Clone and install

```bash
git clone <your-repo-url>
cd finance-backend
npm install
```

### Step 2 — Start infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432` (database: `finapi_dev`)
- **Redis 7** on `localhost:6379`

Wait ~5 seconds for both to be healthy:

```bash
docker compose ps   # both should show "healthy"
```

### Step 3 — Configure environment

```bash
cp .env.example .env
```

Then open `.env` and set your `ACCESS_TOKEN_SECRET`:

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as the value of `ACCESS_TOKEN_SECRET` in `.env`.

All other defaults in `.env.example` work as-is for local development.

### Step 4 — Set up the database

```bash
# Generate the Prisma client
npm run db:generate

# Push schema to PostgreSQL (creates all tables)
npm run db:push

# Seed with system categories, sample users, and 50 financial records
npm run db:seed
```

### Step 5 — Start the development server

```bash
npm run dev
```

The server starts on **http://localhost:3000**

```
🚀 Finance API running  port=3000  env=development
   Docs:   http://localhost:3000/api/docs
   Health: http://localhost:3000/health
```

### Step 6 — Verify

```bash
# Health check
curl http://localhost:3000/health

# Login as admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@finapi.dev","password":"Admin@12345"}'
```

---

## 5. Environment Variables

All variables are in `.env.example`. Copy it to `.env` and fill in the required values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Controls logging, error verbosity, cookie security |
| `PORT` | No | `3000` | HTTP server port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis URL — app runs without it (no caching) |
| `ACCESS_TOKEN_SECRET` | **Yes** | — | 32-byte random hex — signs all JWT access tokens |
| `ACCESS_TOKEN_TTL` | No | `900` | Access token lifetime in seconds (default 15 min) |
| `REFRESH_TOKEN_TTL_DAYS` | No | `30` | Refresh token lifetime in days |
| `BCRYPT_COST` | No | `12` | bcrypt work factor — increase for stronger hashing |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (default 15 min) |
| `RATE_LIMIT_MAX` | No | `100` | Global requests per window per IP |
| `RATE_LIMIT_AUTH_MAX` | No | `10` | Auth endpoint requests per window per IP |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
| `LOG_LEVEL` | No | `info` | `error` \| `warn` \| `info` \| `debug` |

---

## 6. Project Structure

```
finance-backend/
├── prisma/
│   ├── schema.prisma          # Complete data model — 5 models, 5 enums
│   └── seed.ts                # Seeds categories, users, and 50 sample records
│
├── src/
│   ├── config/
│   │   ├── index.ts           # Typed environment config
│   │   ├── database.ts        # Prisma client singleton
│   │   ├── logger.ts          # Winston logger (dev: coloured, prod: JSON)
│   │   └── swagger.ts         # OpenAPI 3.0 spec config
│   │
│   ├── middleware/
│   │   ├── authenticate.ts    # JWT verification — attaches req.user
│   │   ├── authorize.ts       # RBAC guard factory — authorize(Role.ADMIN)
│   │   ├── validate.ts        # Zod schema middleware — body / query / params
│   │   ├── rateLimiter.ts     # Redis-backed global + auth-specific limiters
│   │   └── errorHandler.ts    # Global error handler + 404 handler
│   │
│   ├── shared/
│   │   ├── types/index.ts     # Shared TypeScript interfaces and enums
│   │   ├── errors/index.ts    # AppError hierarchy (7 typed error classes)
│   │   └── utils/index.ts     # Response builders, pagination, date helpers
│   │
│   ├── cache/index.ts         # Redis client, cache-aside helpers, TTL constants
│   ├── audit/index.ts         # Fire-and-forget audit writer + query service
│   │
│   ├── modules/
│   │   ├── auth/              # Register, login, refresh, logout, me, password
│   │   ├── users/             # User CRUD, role & status management
│   │   ├── records/           # Financial record CRUD, filter, search, export
│   │   ├── dashboard/         # 6 analytics endpoints — all Redis-cached
│   │   ├── categories/        # Category management
│   │   └── audit/             # Audit log query interface
│   │
│   ├── app.ts                 # Express app factory (middleware + routes)
│   └── server.ts              # Entry point — connects DB/Redis, starts server
│
├── docker-compose.yml         # PostgreSQL 16 + Redis 7 for local dev
├── .env.example               # All environment variables documented
├── tsconfig.json
├── eslint.config.js
└── package.json
```

Each module follows the same internal structure:

```
modules/records/
├── records.schema.ts      # Zod validation schemas
├── records.repository.ts  # Database queries only (no business logic)
├── records.service.ts     # Business logic, cache ops, audit writes
├── records.controller.ts  # Parse request → call service → send response
├── records.router.ts      # Route definitions + middleware chain + Swagger docs
└── records.spec.ts        # Unit tests with mocked repository
```

---

## 7. Data Model

Five tables with clear separation of concerns:

```
users               — Accounts with role + soft-delete
categories          — System and custom transaction categories
financial_records   — Core transaction data with soft-delete
refresh_tokens      — Hashed tokens for JWT rotation
audit_logs          — Append-only, immutable event trail
```

### Seed Data

Running `npm run db:seed` creates:

**System Categories (14 — cannot be deleted)**

| Name | Type |
|---|---|
| Salary | INCOME |
| Freelance Income | INCOME |
| Investment Returns | INCOME |
| Other Income | INCOME |
| Rent / Mortgage | EXPENSE |
| Utilities | EXPENSE |
| Groceries | EXPENSE |
| Transport | EXPENSE |
| Healthcare | EXPENSE |
| Education | EXPENSE |
| Entertainment | EXPENSE |
| Dining Out | EXPENSE |
| Insurance | EXPENSE |
| Transfer | BOTH |

**Seed Users**

| Email | Password | Role |
|---|---|---|
| admin@finapi.dev | Admin@12345 | ADMIN |
| analyst@finapi.dev | Analyst@12345 | ANALYST |
| viewer@finapi.dev | Viewer@12345 | VIEWER |

**Sample Records** — 50 realistic records spread across the past 6 months covering salary, rent, groceries, transport, freelance income, and investment returns. Immediately usable for dashboard testing.

---

## 8. Authentication

The system uses **short-lived Access Tokens** (15 min) paired with **long-lived Refresh Tokens** (30 days).

### Token Flow

```
POST /api/v1/auth/login
  → Returns: { accessToken }  +  Sets HttpOnly cookie: refreshToken

Use accessToken in:
  Authorization: Bearer <accessToken>

When accessToken expires:
POST /api/v1/auth/refresh  (cookie sent automatically)
  → Returns: new { accessToken }  +  Rotates refreshToken cookie

POST /api/v1/auth/logout
  → Revokes refreshToken in DB, clears cookie
```

### Security Details

| Property | Value |
|---|---|
| Access token algorithm | HS256 |
| Access token TTL | 15 minutes |
| Refresh token | 64-byte cryptographically random hex |
| Refresh token storage | SHA-256 hash in DB; raw value only in HttpOnly cookie |
| Refresh token TTL | 30 days |
| Cookie flags | HttpOnly, Secure (prod), SameSite=Strict |
| Rotation | Old token revoked on every refresh; new token issued |
| Reuse detection | Presenting a revoked token revokes all tokens for that user |
| Password hashing | bcrypt, cost factor 12 |

---

## 9. Role-Based Access Control

Three roles with escalating permissions. Enforced by the `authorize()` middleware on every route — a wrong role returns `403 Forbidden` before the controller is ever called.

### Permission Matrix

| Endpoint | VIEWER | ANALYST | ADMIN |
|---|:---:|:---:|:---:|
| `GET /records` | ✅ | ✅ | ✅ |
| `GET /records/:id` | ✅ | ✅ | ✅ |
| `POST /records` | ❌ | ❌ | ✅ |
| `PATCH /records/:id` | ❌ | ❌ | ✅ |
| `DELETE /records/:id` | ❌ | ❌ | ✅ |
| `POST /records/:id/restore` | ❌ | ❌ | ✅ |
| `GET /records/export` | ❌ | ✅ | ✅ |
| `GET /dashboard/summary` | ✅ | ✅ | ✅ |
| `GET /dashboard/recent` | ✅ | ✅ | ✅ |
| `GET /dashboard/trends` | ❌ | ✅ | ✅ |
| `GET /dashboard/categories` | ❌ | ✅ | ✅ |
| `GET /dashboard/top-categories` | ❌ | ✅ | ✅ |
| `GET /dashboard/comparison` | ❌ | ✅ | ✅ |
| `GET /categories` | ✅ | ✅ | ✅ |
| `POST /categories` | ❌ | ❌ | ✅ |
| `PATCH /categories/:id` | ❌ | ❌ | ✅ |
| `DELETE /categories/:id` | ❌ | ❌ | ✅ |
| `GET /users` | ❌ | ❌ | ✅ |
| `POST /users` | ❌ | ❌ | ✅ |
| `PATCH /users/:id/role` | ❌ | ❌ | ✅ |
| `PATCH /users/:id/status` | ❌ | ❌ | ✅ |
| `DELETE /users/:id` | ❌ | ❌ | ✅ |
| `GET /audit-logs` | ❌ | ❌ | ✅ |

---

## 10. API Reference

**Base URL:** `http://localhost:3000/api/v1`

All endpoints require `Authorization: Bearer <accessToken>` unless marked **Public**.

---

### Auth — `/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create a new user account |
| `POST` | `/auth/login` | Public | Authenticate; receive access token + refresh cookie |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token; get new access token |
| `POST` | `/auth/logout` | Any role | Revoke refresh token; clear cookie |
| `GET` | `/auth/me` | Any role | Get current user's profile |
| `PATCH` | `/auth/me/password` | Any role | Change own password (invalidates all sessions) |

**Register / Login body:**
```json
{
  "email": "user@example.com",
  "password": "MyPass@123",
  "fullName": "Jane Smith",
  "role": "VIEWER"
}
```

---

### Users — `/users` *(Admin only)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List users — filter by `role`, `status`, `search`; paginated |
| `POST` | `/users` | Create user with specified role |
| `GET` | `/users/:id` | Get user by ID |
| `PATCH` | `/users/:id` | Update name or email |
| `PATCH` | `/users/:id/role` | Change role — cannot change own role |
| `PATCH` | `/users/:id/status` | Set `ACTIVE`, `INACTIVE`, or `SUSPENDED` |
| `DELETE` | `/users/:id` | Soft-delete — cannot delete own account |

---

### Financial Records — `/records`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/records` | All roles | List with full filtering, sorting, pagination |
| `GET` | `/records/export` | Analyst, Admin | Export as `json` or `csv` |
| `GET` | `/records/:id` | All roles | Single record with category and creator detail |
| `POST` | `/records` | Admin | Create a record |
| `PATCH` | `/records/:id` | Admin | Update — fails if record is soft-deleted |
| `DELETE` | `/records/:id` | Admin | Soft-delete |
| `POST` | `/records/:id/restore` | Admin | Restore a soft-deleted record |

**Query parameters for `GET /records`:**

| Parameter | Type | Description |
|---|---|---|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Per page, max 100 (default: 20) |
| `type` | string | `INCOME` \| `EXPENSE` \| `TRANSFER` |
| `categoryId` | uuid | Filter by category |
| `date_from` | YYYY-MM-DD | Start of date range (inclusive) |
| `date_to` | YYYY-MM-DD | End of date range (inclusive) |
| `min_amount` | number | Minimum amount |
| `max_amount` | number | Maximum amount |
| `search` | string | Searches description and reference number |
| `tags` | string[] | Records containing all specified tags |
| `sort_by` | string | `date` \| `amount` \| `created_at` (default: `date`) |
| `sort_order` | string | `asc` \| `desc` (default: `desc`) |
| `includeDeleted` | boolean | Admin only — include soft-deleted records |

**Create / Update record body:**
```json
{
  "amount": 8500.00,
  "type": "INCOME",
  "date": "2026-04-01",
  "description": "Monthly salary",
  "referenceNumber": "SAL-2026-04",
  "currency": "USD",
  "tags": ["salary", "regular"],
  "categoryId": "<uuid>"
}
```

---

### Dashboard — `/dashboard`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/dashboard/summary` | All roles | Total income, expenses, net balance |
| `GET` | `/dashboard/recent` | All roles | Last N transactions (default 10, max 50) |
| `GET` | `/dashboard/trends` | Analyst, Admin | Monthly or weekly income/expense over time |
| `GET` | `/dashboard/categories` | Analyst, Admin | Per-category totals with percentages |
| `GET` | `/dashboard/top-categories` | Analyst, Admin | Top N categories by amount |
| `GET` | `/dashboard/comparison` | Analyst, Admin | Current vs previous month |

**Summary response example:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-04-01", "to": "2026-04-30" },
    "totalIncome": "8500.00",
    "totalExpenses": "3240.50",
    "totalTransfer": "0.00",
    "netBalance": "5259.50",
    "transactionCount": { "income": 2, "expense": 8, "transfer": 0, "total": 10 },
    "currency": "USD"
  }
}
```

**Trends parameters:** `period=monthly|weekly`, `months=1-24`

---

### Categories — `/categories`

| Method | Path | Access | Description |
|---|---|---|---|
| `GET` | `/categories` | All roles | List all categories; add `withCounts=true` for record counts |
| `GET` | `/categories/:id` | All roles | Get single category |
| `POST` | `/categories` | Admin | Create custom category |
| `PATCH` | `/categories/:id` | Admin | Update name, type, color, or icon |
| `DELETE` | `/categories/:id` | Admin | Delete — fails for system categories or if records are linked |

---

### Audit Log — `/audit-logs` *(Admin only)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit-logs` | Paginated log — filter by `actorId`, `action`, `resource`, `date_from`, `date_to` |
| `GET` | `/audit-logs/records/:id` | Full change history for one financial record |

**Tracked actions:** `CREATE`, `UPDATE`, `DELETE`, `RESTORE`, `LOGIN`, `LOGOUT`, `ROLE_CHANGE`, `STATUS_CHANGE`, `PASSWORD_CHANGE`

---

## 11. Request & Response Format

### Success Response

```json
{
  "success": true,
  "data": { },
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

`meta` is only present on paginated list responses.

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": [
      { "field": "amount", "message": "Amount must be positive" },
      { "field": "date",   "message": "Date must be YYYY-MM-DD" }
    ]
  }
}
```

`fields` is only present on `422 Validation Error` responses.

### HTTP Status Codes

| Code | When |
|---|---|
| `200` | Successful GET or PATCH |
| `201` | Successful POST (resource created) |
| `204` | Successful DELETE or logout (no body) |
| `400` | Business rule violation (e.g. updating a deleted record) |
| `401` | Missing or expired access token |
| `403` | Valid token but insufficient role |
| `404` | Resource not found |
| `409` | Conflict — duplicate email or reference number |
| `422` | Zod validation failure with field-level errors |
| `429` | Rate limit exceeded — `Retry-After` header included |
| `500` | Unhandled server error — safe message in production |

---

## 12. Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

### What is tested

**Auth service** — duplicate email registration, inactive account block, wrong password rejection, same-password change guard

**Users service** — not-found handling, email conflict on create, self-role-change prevention, self-delete prevention

**Records service** — not-found, update of deleted record, soft-delete of already-deleted record, restore of non-deleted record, JSON and CSV export formats

**Categories service** — name conflict, system category deletion block, deletion with linked records block, successful deletion

All service tests use full mock isolation — no database connection required. The repository layer is mocked so tests run instantly without any infrastructure.

---

## 13. API Documentation (Swagger)

Interactive Swagger UI is served at:

```
http://localhost:3000/api/docs
```

Machine-readable OpenAPI 3.0 JSON spec at:

```
http://localhost:3000/api/docs.json
```

The spec is auto-generated from JSDoc annotations on the route files. Authenticate directly in the Swagger UI using the **Authorize** button with a Bearer token obtained from `POST /auth/login`.

---

## 14. Assumptions & Design Decisions

### Assumptions

**First Admin via seed** — There is no public self-registration for Admin accounts. The initial Admin is created by `npm run db:seed`. All subsequent users can be created by an Admin via `POST /users` or `POST /auth/register` (which defaults to the `VIEWER` role).

**Multi-currency modelled, not converted** — Every record stores a `currency` field (ISO 4217). Dashboard aggregates assume a single reporting currency. Exchange-rate conversion is not in scope — it would require a live FX data feed.

**Records are globally readable** — Any authenticated user regardless of role can read all financial records. Role controls write access only. If per-user data scoping were required (e.g. each analyst sees only their own records), a `ownerId` field and scope filter would be added.

**Soft delete is the only delete** — Neither users nor records are ever physically removed via the API. Hard deletion can be performed by a DBA or scheduled maintenance job on records older than a retention policy threshold.

**Audit log is append-only** — `writeAudit()` is a fire-and-forget `INSERT`. No `UPDATE` or `DELETE` is ever issued against `audit_logs`. A failure to write an audit entry is logged as a warning but never surfaces to the caller — the main operation always succeeds.

**Bcrypt cost 12 in production** — The default cost factor is 12. It is set to 4 in the test environment via `.env.test` so that tests involving password hashing run at acceptable speed.

### Design Decisions & Trade-offs

**Prisma over raw SQL** — Prisma provides compile-time type safety on query results and handles migrations cleanly. The slight abstraction overhead is worth eliminating a class of SQL injection risks and keeping TypeScript types in sync with the schema automatically.

**Zod over Joi or class-validator** — Zod schemas are TypeScript types. There is no need to maintain a separate interface and a separate validation schema for the same shape. Zod also integrates cleanly with the middleware pattern used here.

**`resourceId` in AuditLog is not a foreign key** — Making it an FK to `financial_records` would mean audit entries could only reference that one table. Storing it as a plain UUID string allows the same table to audit any resource type (`users`, `categories`, `financial_records`) and means entries survive even if the source row is eventually purged.

**Redis is optional** — The application starts and functions fully without Redis. When Redis is unavailable, caching and Redis-backed rate limiting are silently disabled (rate limiting falls back to in-memory). This makes local development possible without Docker.

**Express over Fastify** — Fastify would offer higher throughput, but Express has a significantly richer middleware ecosystem and wider familiarity. For this workload — a dashboard API with moderate concurrency — Express is more than sufficient.

**Short-lived access tokens (15 min)** — Keeping access tokens short-lived limits the exposure window if one is intercepted. The refresh token rotation scheme (with reuse detection) ensures legitimate users are never logged out while still protecting against token theft.

---

## 15. Future Improvements

Given more time, the following would be prioritised:

1. **Cursor-based pagination** — Offset pagination degrades at high row counts. Cursor-based (keyset) pagination would be added for the records endpoint.

2. **WebSocket live dashboard** — Push real-time balance updates to connected dashboard clients on every record write using Socket.io or native WebSockets.

3. **Multi-currency conversion** — Integrate a live FX rate feed (e.g. Open Exchange Rates) and add a `reporting_currency` concept to dashboard aggregates so mixed-currency records are normalised before summing.

4. **Event sourcing for records** — Replace the current before/after snapshot in audit logs with a proper event log so any historical state of a record can be reconstructed.

5. **Role hierarchy expansion** — Add granular permissions (e.g. `ANALYST` with write access to specific categories) using a permission-bitmask approach rather than hard-coded role enums.

6. **Scheduled jobs** — A cron job to hard-delete soft-deleted records older than a configurable retention period, and another to prune expired refresh tokens.

7. **Integration test suite** — A separate test database with full Prisma migrations would enable end-to-end HTTP tests using Supertest against the real database, covering the full request lifecycle.

8. **Docker production image** — A multi-stage `Dockerfile` that produces a minimal production image with only the compiled `dist/` output and production `node_modules`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run db:generate` | Generate Prisma client after schema changes |
| `npm run db:push` | Push schema to database (dev — no migration file) |
| `npm run db:migrate` | Create and apply a named migration |
| `npm run db:seed` | Seed database with categories, users, and sample records |
| `npm run db:reset` | Drop and recreate database, then re-seed |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

*Built for the Finance Data Processing & Access Control Backend assignment.*