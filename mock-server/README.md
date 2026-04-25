# HCM Mock Server Documentation

The **HCM Mock Server** acts as the external Human Capital Management system. In this architecture, it is the **Source of Truth** for employee annual leave balances and the authoritative approval engine.

## Core Functionality

### 1. Data Management
- **Balances**: Stores the current annual leave balance for employees (e.g., `employee001` starts with 25 days).
- **Leave Requests**: Tracks the lifecycle of leave requests submitted from external HR systems.
- **Statuses**: `PENDING`, `APPROVED`, `REJECTED`.

### 2. API Endpoints

- **`POST /hcm/submit`**
  - Submits a new leave request.
  - Returns a `requestId` and status `PENDING_MANAGER`.
  
- **`GET /hcm/corpus`**
  - Returns the entire state of the HCM: all employee balances and all leave requests.
  - Used by ExampleHR for batch synchronization.

- **`POST /hcm/manager/approve`**
  - Body: `{ "requestId": "..." }`
  - Moves the request to `APPROVED` and **deducts** the requested days from the HCM balance.

- **`POST /hcm/manager/reject`**
  - Body: `{ "requestId": "..." }`
  - Moves the request to `REJECTED`. Balance is **not** deducted.

- **`GET /hcm/request/:id`**
  - Returns the current status of a specific request.
  - Used by ExampleHR's Smart Listener to detect manager decisions.

- **`POST /hcm/anniversary`**
  - Body: `{ "employeeId": "...", "locationId": "..." }`
  - Adds a **5-day bonus** to the employee's annual leave balance.

---

## How to Run

To start the HCM Mock Server, run the following command from the project root:

```bash
npm i
npm run dev
```

The server will be available at: `http://localhost:3001`
