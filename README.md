
# ExampleHR: Resilience & Sync Engine

This project demonstrates a production-grade **Defensive Sync Architecture** between a microservice (**ExampleHR**) and an external Source of Truth (**Mock HCM**). It is designed to handle asynchronous manager approvals, network failures, and data drift with self-healing background workers.

## Project Structure

The repository is divided into two main components:

-   **/mock-server**: Simulates an external HCM (Human Capital Management) system with its own database, manager approval engine, and anniversary credit logic.
-   **/example-hr**: The main backend service that manages local employee balances, reservations, and resilience logic (Watchdog & Sweep).

---

## 1. Getting Started

To properly test the synchronization and resilience features, you must start the services in the following order:

### Step 1: Run the Mock HCM Server
The Mock Server acts as the external authority. It must be running for ExampleHR to successfully perform initial syncs.

1.  Navigate to the `mock-server` folder.
2.  Install dependencies: `npm install`.
3.  Start the server: `npm run dev`.
    -   *The server will run on [http://localhost:3001](http://localhost:3001).*

### Step 2: Run the ExampleHR Service
This is the core application logic.

1.  Navigate to the `example-hr` folder.
2.  Install dependencies: `npm install`.
3.  Start the service: `npm run dev`.
    -   *The service will run on [http://localhost:3000](http://localhost:3000).*

---

## 2. System Features

-   **Three-Way Handshake:** Employee requests leave $\\rightarrow$ Manager approves on HCM $\\rightarrow$ ExampleHR finalizes balance.
-   **Watchdog Service:** A background worker that retries failed network requests and "Smart Polls" for manager decisions every 2 minutes.
-   **Daily Sweep:** A nightly reconciliation process that detects and fixes balance drifts (e.g., work anniversaries or manual HCM updates).
-   **Optimistic Reservation:** Local balances are deducted immediately upon request to prevent "double-spending" while waiting for the HCM.

---

## 3. Testing the System

Once both servers are running, you can use the provided **`test-suite.md`** to simulate various real-world scenarios, including:

1.  **The Happy Path:** Standard leave request and approval.
2.  **The Chaos Test:** Shutting down the HCM server mid-request to see the Watchdog's self-healing in action.
3.  **The Rejection Flow:** Verifying that a manager rejection in the HCM automatically reverts the local reserved balance.
4.  **The Anniversary Credit:** Triggering a bonus in HCM and seeing the Daily Sweep pick it up.

For a full technical deep-dive into the architecture, refer to the **`trd.md`** file.

---

## 4. Technology Stack
- **Backend:** NestJS, TypeScript
- **Database:** SQLite (Physical isolation between App and HCM)
- **ORM:** TypeORM
- **Scheduling:** @nestjs/schedule
- **HTTP Client:** Axios

-   *The Github Repo is available on [https://github.com/MansoorButt/wizda-takeHomeAssignment](https://github.com/MansoorButt/wizda-takeHomeAssignment).*