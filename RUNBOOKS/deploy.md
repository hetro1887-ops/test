# Runbook: Production Deployment Guide

This document describes the standard procedure for deploying the Finance Dashboard monorepo to production.

## 🚀 Target Infrastructure Architecture

| Layer | Provider | Description |
|---|---|---|
| **Frontend & API** | **Vercel** | Serverless Next.js deployment |
| **ML services** | **Railway / Render** | Docker container hosting for `ml-api` and background workers |
| **Database** | **Neon / AWS Aurora** | Serverless PostgreSQL database |
| **In-Memory Cache** | **Upstash Redis** | Managed serverless Redis for BullMQ |

---

## 🛠️ Step-by-Step Deployment Procedure

### 1. Database Provisioning & Schema Deploy
1. Spin up a new PostgreSQL database branch on Neon.
2. Retrieve the `DATABASE_URL` connection string.
3. Configure environment variables and run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### 2. Deploy ML Services & Background Workers (Railway)
1. Link your GitHub repository to Railway.
2. Configure environment variables for the workers:
   - `REDIS_URL`: Connection string to Upstash Redis.
   - `DATABASE_URL`: Connection string to Neon PostgreSQL.
   - `ENCRYPTION_KEY`: 32-byte AES key.
   - `ML_SERVICE_URL`: URL of the FastAPI container.
3. Deploy the FastAPI service `apps/ml-api` container using the provided `Dockerfile`.
4. Deploy the background jobs package `packages/jobs` with the entry command `pnpm run worker`.

### 3. Deploy Frontend (Vercel)
1. Import the project workspace into Vercel.
2. Select `apps/web` as the root directory.
3. Set the following environment variables:
   - `DATABASE_URL`: Neon connection string.
   - `ENCRYPTION_KEY`: 32-byte AES key.
   - `NEXTAUTH_SECRET`: Secret key for JWT sessions.
   - `NEXTAUTH_URL`: Production domain.
   - `PLAID_CLIENT_ID` & `PLAID_SECRET`: Plaid API production keys.
   - `ML_SERVICE_URL`: URL of the deployed FastAPI service on Railway.
   - `REDIS_URL`: Upstash connection string.
4. Click **Deploy**.

---

## 🔍 Post-Deployment Smoke Tests
1. **Health Checks**: Verify `https://<ml-api-domain>/health` returns `{"status": "healthy"}`.
2. **Onboarding Flow**: Log in to a test account, trigger Plaid Link, and ensure initial transaction sync completes without errors.
3. **Database Audit**: Verify `sync_logs` table records a successful `COMPLETED` entry after initial sync.
