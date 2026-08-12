# Secure Identity & Authentication System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Argon2id](https://img.shields.io/badge/Security-Argon2id-blueviolet?style=for-the-badge)](https://github.com/P-H-C/phc-winner-argon2)
[![Vitest](https://img.shields.io/badge/Testing-Vitest-yellow?style=for-the-badge&logo=vitest&logoColor=black)](https://vitest.dev/)

An enterprise-grade, secure full-stack identity and authentication system engineered with industry security standards: Argon2id password hashing, server-side session management with SHA-256 token hashing, HttpOnly SameSite=Lax cookies, Google OpenID Connect OAuth 2.0, multi-layered brute-force defense, heuristic risk engine, security event audit logging, and a glassmorphism React SPA interface.

---

## 🔒 Security Architecture & Objectives Satisfied

- **Argon2id Password Hashing**: Passwords are never stored in plaintext and hashed using memory-hard Argon2id (64MB memory cost, 3 iterations, 4 parallelism). Enforces 12–128 character limits and detects common breached passwords.
- **Server-Side Session Architecture**: Generates 32-byte `base64url` cryptographically random session tokens (`crypto.randomBytes(32)`). Only the SHA-256 hash of the token is stored in the database.
- **HttpOnly Cookie Transport**: Raw session tokens are delivered exclusively in `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/` cookies. **Zero tokens are ever stored in `localStorage` or `sessionStorage`**.
- **Brute-Force & Enumeration Resistance**: 
  - Generic authentication responses (`"Invalid email or password."`) prevent account enumeration.
  - Progressive delays on 5+ failed attempts.
  - Automatic 15-minute account lockout after 10 failed login attempts.
  - IP and email rate limiting.
- **Google OAuth 2.0 & OpenID Connect**: PKCE state verification, ID Token issuer & audience validation, verified email enforcement, and safe account linking.
- **Suspicious Login Risk Engine**: Evaluates login context (IP changes, User-Agent changes, device changes, recent failure history) into risk scores (`NORMAL`, `SUSPICIOUS`, `HIGH_RISK`).
- **Security Audit Trail**: Logs auditable events (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`, `SESSION_CREATED`, `SESSION_REVOKED`, `ALL_SESSIONS_REVOKED`, `SUSPICIOUS_LOGIN`) without recording raw tokens or sensitive passwords.

---

## 🚀 Tech Stack

- **Backend**: Node.js, TypeScript, Express.js, Prisma ORM, Argon2id (`argon2`), Zod validation, `google-auth-library`, Cookie Parser, Helmet, CORS.
- **Frontend**: React 19, TypeScript, Vite, React Router DOM v7, Lucide Icons, Vanilla CSS (Custom Glassmorphism Design System).
- **Database**: SQLite (default for development/testing via Prisma), fully PostgreSQL compatible.
- **Testing**: Vitest + Supertest automated security test suite (16 comprehensive tests, 100% pass rate).

---

## 🗄️ Database Schema

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id               String          @id @default(uuid())
  email            String          @unique
  passwordHash     String?
  name             String?
  avatarUrl        String?
  emailVerified    Boolean         @default(false)
  failedLoginCount Int             @default(0)
  lockedUntil      DateTime?
  lastLoginAt      DateTime?
  lastLoginIp      String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  sessions         Session[]
  oauthAccounts    OAuthAccount[]
  loginAttempts    LoginAttempt[]
  securityEvents   SecurityEvent[]
}

model Session {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash    String    @unique
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  lastActiveAt DateTime  @default(now())
  revokedAt    DateTime?
  ipAddress    String?
  userAgent    String?
  deviceName   String?
}

model OAuthAccount {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider          String
  providerAccountId String
  createdAt         DateTime @default(now())

  @@unique([provider, providerAccountId])
}

model LoginAttempt {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  email     String
  ipAddress String
  userAgent String?
  status    String
  reason    String?
  createdAt DateTime @default(now())
}

model SecurityEvent {
  id        String   @id @default(uuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  ipAddress String?
  userAgent String?
  metadata  String?
  createdAt DateTime @default(now())
}
```

---

## 📡 API Reference Summary

| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Rate Limited | Register new account with email & password |
| `POST` | `/api/auth/login` | Rate Limited | Authenticate credentials & issue HttpOnly session cookie |
| `POST` | `/api/auth/logout` | `requireAuth` | Revoke session server-side & clear cookie |
| `GET` | `/api/auth/me` | `requireAuth` | Fetch current user sanitized profile |
| `GET` | `/api/auth/sessions` | `requireAuth` | List active sessions (device, IP, last active) |
| `DELETE` | `/api/auth/sessions/:id` | `requireAuth` | Revoke single session (enforces user ownership) |
| `DELETE` | `/api/auth/sessions` | `requireAuth` | Revoke all active sessions for current user |
| `GET` | `/api/auth/google` | Public | Initialize Google OAuth 2.0 redirect |
| `GET` | `/api/auth/google/callback` | Public | Handle Google OAuth redirect & OIDC validation |

---

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js >= v18.0.0
- npm >= v9.0.0

### 2. Installation & Setup
Clone the repository and install root dependencies:

```bash
git clone https://github.com/yeabsirahailegiorgis62-gif/Authentication.git
cd Authentication
```

Install backend and frontend dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. Environment Configuration
Create `backend/.env`:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
CLIENT_URL="http://localhost:5173"
SESSION_SECRET="super-secret-crypto-random-key-32-chars-minimum"
GOOGLE_CLIENT_ID="mock-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="mock-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/api/auth/google/callback"
```

### 4. Database Setup
Generate Prisma Client and push schema:

```bash
cd backend
npx prisma db push
npx prisma generate
cd ..
```

### 5. Running with Docker Compose (Recommended for Instant Deployment)
Build and spin up both backend API and frontend Nginx containers with one command:

```bash
docker compose up --build -d
```

Access the containerized application:
- **Frontend SPA**: [http://localhost:80](http://localhost:80)
- **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

To stop containerized services:
```bash
docker compose down
```

### 6. Local Manual Setup (Without Docker)
Run both backend and frontend servers concurrently:

```bash
# Start Backend API (http://localhost:4000)
npm run dev:backend

# Start Frontend React SPA (http://localhost:5173)
npm run dev:frontend
```

---

## 🧪 Automated Testing

Execute the Vitest + Supertest security test suite:

```bash
npm run test:backend
```

Run static typechecking:

```bash
npm run typecheck:backend
npm run typecheck:frontend
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
