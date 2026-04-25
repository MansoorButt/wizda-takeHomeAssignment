# ExampleHR Documentation

**ExampleHR** is a microservice designed to manage employee time-off requests with a "Local-First" consistency model. It allows employees to request time off even when the HCM is busy or slow, by managing local reservations.

## Core Architecture

### 1. Local Reservations
When an employee requests time off, ExampleHR immediately subtracts the days from the local `EmployeeBalance` record.
- If HCM is up: The request is submitted immediately.
- If HCM is down: The request is marked as `FAILED`.

### 2. Linkage to HCM Mock Server
ExampleHR communicates with the HCM Mock Server (on port 3001) via the `HcmClientService`. The HCM is the final authority for approvals.

### 3. Automated Services

#### A. Sync Service (Batch Sweep)
- **Schedule**: Triggers automatically on **Startup** and **Daily at 2:00 AM**.
- **Logic**: 
  - Fetches the HCM "Corpus" (all balances and requests).
  - Reconciles local balances to match `HCM_Balance - Local_Pending_Reservations`.
  - Cleans up state by detecting requests that were approved or rejected directly in the HCM.

#### B. Watchdog Service (Smart Status Listener)
- **Schedule**: Every **2 minutes**.
- **Action 1 (Retry)**: Finds `FAILED` requests and attempts to resubmit them to HCM.
- **Action 2 (Listen)**: Finds `PENDING_APPROVAL` requests and polls HCM for their current status.
  - If HCM shows `APPROVED`: Updates local status to `SYNCED`.
  - If HCM shows `REJECTED`: Immediately reverts the local reservation, giving the days back to the employee.

---

## API Endpoints

- **`GET /time-off/balance?employeeId=...&locationId=...`**: Check local balance.
- **`POST /time-off/request`**: Submit a new leave request.
- **`POST /time-off/anniversary`**: Manually trigger a work anniversary bonus (adds 5 days in HCM; picked up by next sync).
- **`POST /time-off/sync/trigger`**: Manually trigger a Batch Sync Sweep.
- **`POST /time-off/watchdog/trigger`**: Manually trigger the Watchdog/Smart Listener.

---

## How to Run

To start the ExampleHR microservice, run the following command from the project root:

```bash
npm i
npm run dev
```

The service will be available at: `http://localhost:3000`
