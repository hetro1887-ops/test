# Runbook: Emergency Rollback Procedure (< 5 minutes)

This document describes the steps required to rollback a faulty deployment to the last stable release.

## 🚨 Trigger Conditions
1. **Critical Outage (P0)**: Main dashboard fails to load or authentication is broken.
2. **Data Integrity Failure**: Sync worker corrupting transaction records or failing to deduplicate.
3. **ML Service Out of Memory (OOM)**: ML inference latency exceeds 500ms or crashes under load.

---

## ⏱️ Step-by-Step Rollback Walkthrough

### Step 1: Revert Vercel Frontend Deployment (1 minute)
1. Go to the **Vercel Dashboard** -> Select the project -> **Deployments**.
2. Identify the last known stable deployment (labeled as `Production`).
3. Click the **three dots** icon next to it and select **Redeploy** or click **Promote to Production**.
4. The switch is instantaneous (no rebuild needed if using a previous deployment container).

### Step 2: Rollback Railway ML Services & Workers (2 minutes)
1. Open the **Railway Console** -> Select the project dashboard.
2. Under the service settings, click on the **Deployments** tab.
3. Select the previous stable deployment (associated with the previous git hash).
4. Click **Redeploy** / **Rollback**.
5. Once complete, verify the worker container logs to ensure it successfully reconnects to Redis.

### Step 3: Database Rollback (if schema changed) (2 minutes)
If the new deployment introduced breaking schema changes:
1. Open the **Neon Console**.
2. Restore the database to the last automatic snapshot taken before the deploy (point-in-time recovery).
3. If point-in-time recovery is not possible, execute migration down-scripts manually:
   ```bash
   npx prisma db push --force-reset # WARNING: Restores to seeded baseline, use as absolute last resort
   ```
4. Verify connections are healthy by running post-deployment checks.
