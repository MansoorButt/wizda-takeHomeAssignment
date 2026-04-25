# Test Suite: ExampleHR Resilience & Sync Engine

This test suite covers the end-to-end functional and non-functional requirements of the ExampleHR backend, focusing on data integrity, state transitions, and self-healing capabilities.

---

## 1. Core Functional Scenarios (The Happy Path)

### 1.1 Initial Balance Discovery (Lazy Load)
* **Scenario:** Requesting a balance for a new employee not yet in the local database.
* **Setup:** Clear local `employee_balances` table.
* **Action:** `GET http://localhost:3000/time-off/balance?employeeId=employee001&locationId=NYC`
* **Expectation:**
    * System performs a Cache Miss.
    * Calls `HcmClient.fetchBalance`.
    * Persists balance (25.0) to local DB.
    * Returns 25.0 to user.

### 1.2 Successful Leave Handshake (Three-Way)
* **Scenario:** Employee requests leave, manager approves, system finalizes.
* **Action 1 (Request):** `POST /time-off/request` (requestedDays: 2).
* **Expectation 1:** Local balance becomes 23.0; Status is `PENDING_APPROVAL`.
* **Action 2 (Approval):** `POST http://localhost:3001/hcm/manager/approve` (with `hcmRequestId`).
* **Action 3 (Sync):** `POST /time-off/watchdog/trigger` (Smart Polling).
* **Expectation 2:** Local status moves to `SYNCED`. Final balances match at 23.0.

---

## 2. Resilience Scenarios (The Defensive Layer)

### 2.1 The "Dead HCM" Recovery
* **Scenario:** Network failure during the initial request.
* **Setup:** Shutdown Mock-HCM Server.
* **Action:** `POST /time-off/request` (requestedDays: 3).
* **Expectation:**
    * Local DB deducts days (Reservation).
    * Request status becomes `FAILED`.
* **Recovery:** Restart HCM; `POST /time-off/watchdog/trigger`.
* **Expectation:** Watchdog detects `FAILED`, retries, and moves status to `PENDING_APPROVAL`.

### 2.2 The "Manager Rejection" Flow
* **Scenario:** Manager denies a request that was already reserved locally.
* **Setup:** Create request (Status: `PENDING_APPROVAL`, Local Balance: 20).
* **Action:** `POST http://localhost:3001/hcm/manager/reject`.
* **Action 2:** `POST /time-off/watchdog/trigger`.
* **Expectation:**
    * Watchdog detects `REJECTED` in HCM.
    * `handleRejection` is called.
    * Local balance reverts to 23.0. Status becomes `REJECTED`.

---

## 3. Consistency Scenarios (The Daily Sweep)

### 3.1 External Balance Increase (Work Anniversary)
* **Scenario:** HCM balance increases due to an event outside ExampleHR.
* **Action:** `POST /time-off/anniversary` (Adds 5 days in HCM only).
* **Action 2:** `POST /time-off/sync/trigger` (Daily Sweep simulation).
* **Expectation:** Sweep detects `HCM (30) > Local (25)`. Local DB is updated to 30.0.

### 3.2 Out-of-Band Deduction (Manual Drift)
* **Scenario:** An admin manually changes balance in HCM.
* **Setup:** Modify HCM DB directly (e.g., set balance to 10).
* **Action:** `POST /time-off/sync/trigger`.
* **Expectation:** Sweep detects drift and forces Local DB to match HCM (10.0).

---

## 4. Edge Case & Guardrail Scenarios

### 4.1 The "Double-Spend" Block (Optimistic Locking)
* **Scenario:** Preventing an employee from spending "reserved" days.
* **Setup:** Balance is 25.0.
* **Action 1:** Request 24 days. (Local Status: `PENDING_APPROVAL`).
* **Action 2:** Immediately request 2 days.
* **Expectation:** Action 2 returns `400 Bad Request: Insufficient Balance`. The system must respect local reservations even if the HCM hasn't subtracted the days yet.

### 4.2 The "Missing HCM ID" Guard
* **Scenario:** A local request is stuck in `PENDING_APPROVAL` but lost its link to HCM.
* **Setup:** Manually nullify `hcmRequestId` in local DB for a pending request.
* **Action:** Run Watchdog.
* **Expectation:** Watchdog logs a warning and skips the record, preventing a crash. Daily Sweep will handle it later via balance comparison.

---

## 5. Summary Table for Verification

| Scenario | Local Status | Local Balance | HCM Balance | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **Initial Request** | `PENDING_APPROVAL` | Reduced | Original | Success |
| **Approval Sync** | `SYNCED` | Reduced | Reduced | Success |
| **Rejection Sync** | `REJECTED` | Reverted | Original | Success |
| **Network Fail** | `FAILED` | Reduced | Original | Success |
| **Anniversary** | `SYNCED` | Increased | Increased | Success |
