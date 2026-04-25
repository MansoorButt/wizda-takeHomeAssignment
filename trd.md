# Technical Requirements Document (TRD): ExampleHR Resilience & Sync Engine

## 1. Project Overview
**ExampleHR** is a middleware microservice designed to manage employee leave balances. The core challenge is maintaining data consistency between a local database and a third-party Source of Truth (the HCM system) across asynchronous approval workflows and potential network failures.

**Key Objective:** Implement a "Defensive Sync" architecture where ExampleHR reserves resources locally but defers to the HCM for final authority, utilizing self-healing background workers to resolve state mismatches.

---

## 2. System Personas & Lifecycle
1.  **The Employee:** Initiates a request; expects an immediate "Reservation" of their balance.
2.  **The Manager:** Approves or Rejects requests on the HCM side.
3.  **The System (ExampleHR):** Ensures the local state eventually matches the HCM state.

---

## 3. Detailed Architectural Components

### 3.1 The "Reservation" Request Logic (Two-Phase Submission)
When a request is made, the system must not simply wait for a 200 OK from the HCM.
- **Step 1 (Local Transaction):** Deduct the requested days from `EmployeeBalance` and create a `TimeOffRequest` with status `PENDING`.
- **Step 2 (Remote Sync):** Attempt to call the HCM API.
    - If HCM returns `PENDING_MANAGER`: Update local status to `PENDING_APPROVAL` and store the `hcmRequestId`.
    - If HCM returns `APPROVED`: Update status to `SYNCED`.
    - If HCM is unreachable: Update status to `FAILED` (The balance remains deducted/reserved).

### 3.2 The Smart Watchdog (Resilience Layer)
A background service running on a short-cycle cron (e.g., every 2 minutes) to handle two failure modes:
- **Mode A: Network Recovery:** It identifies `FAILED` requests and re-attempts the HCM submission.
- **Mode B: State Polling:** It identifies `PENDING_APPROVAL` requests and queries the HCM for updates. If the manager has approved/rejected in the interim, the Watchdog finalizes the local record.

### 3.3 The Daily Sweep (Consistency Layer)
A deep-reconciliation worker running nightly (2:00 AM) that performs a "Corpus Comparison":
- **Pull:** Fetches the entire employee balance list from HCM.
- **Compare:** For each employee, compares `HCM_Balance` vs `Local_Balance`.
- **Resolve:** - If `HCM > Local`: Likely an anniversary credit or a rejected leave. The system updates the local balance to match HCM.
    - If `HCM < Local`: Indicates an out-of-band deduction. Local balance is forcefully corrected to HCM's value.

---

## 4. Database Schema (TypeORM Entities)

### EmployeeBalance
- `id`: UUID (PK)
- `employeeId`: string (Indexed)
- `locationId`: string
- `balanceAmount`: float (The spendable balance)
- `updatedAt`: timestamp

### TimeOffRequest
- `id`: UUID (PK)
- `hcmRequestId`: string (nullable) - Link to external system
- `employeeId`: string
- `requestedDays`: float
- `status`: Enum (SYNCED, PENDING_APPROVAL, REJECTED, FAILED)
- `createdAt`: timestamp

---

## 5. API Definitions

### ExampleHR (Internal)
- `POST /time-off/request`: Validates local balance, performs reservation, calls HCM.
- `GET /time-off/balance`: Returns local balance; performs a "Lazy Fetch" from HCM if record is missing.
- `POST /time-off/watchdog/trigger`: Manual override to run the resilience logic.

### Mock-HCM (External)
- `POST /hcm/leave`: Accepts request, returns a "Pending" status and a Request ID.
- `GET /hcm/request/:id`: Returns current status of a leave request (PENDING/APPROVED/REJECTED).
- `POST /hcm/manager/approve`: Simulates manager action; deducts balance in HCM.
- `POST /hcm/anniversary`: Simulates external credit; increases balance in HCM.

---

## 6. Implementation Checklist for the Agent

1. **Phase 1: Foundation**
   - Setup two separate SQLite databases (example-hr.sqlite, hcm-mock.sqlite).
   - Implement the Entity models with strict TypeORM decorators.

2. **Phase 2: The Handshake**
   - Build `TimeOffService` with a focus on Transactional Integrity. The local balance must be deducted *before* the API call.

3. **Phase 3: The Watchdog**
   - Implement `@nestjs/schedule` cron jobs.
   - Ensure the Watchdog can distinguish between a 500 error (Retry) and a 400 error (Rejection).

4. **Phase 4: The Sweep**
   - Implement a Batch Fetching mechanism in `HcmClient`.
   - Build the logic to "Heal" drifts (Anniversaries vs. Manual Errors).

---

## 7. Quality Assurance (Chaos Testing)
The system is only successful if it passes the following:
- **The "Dead HCM" Test:** Stop the HCM server, make a request, restart HCM, and verify the Watchdog fixes the state.
- **The "Anniversary" Test:** Increase balance in HCM directly and verify the Daily Sweep picks it up.
- **The "Double Spend" Test:** Submit a request for the full balance; immediately try to submit another. The second must be blocked by the local reservation.
