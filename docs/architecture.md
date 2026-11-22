# FixTrack architecture

```mermaid
flowchart LR
  subgraph Browser
    V[Vue 3 SPA<br/>Pinia · Router · Tailwind · Chart.js]
  end
  V -- "HTTPS /api (JWT)" --> N[nginx / Vite proxy]
  N --> A[Express API]
  A --> P[(PostgreSQL)]
  A --> R[(Redis<br/>rate limiting)]
  A -- "triage + duplicate check" --> C[Claude API]
  A --> F[/uploads<br/>ticket photos/]
  J1[node-cron: SLA overdue job<br/>every 5 min] --> P
  J2[node-cron: preventive-maintenance job<br/>hourly] --> P
  A --- J1
  A --- J2
```

## Ticket lifecycle

```mermaid
stateDiagram-v2
  [*] --> Open: student creates
  Open --> Assigned: admin assigns
  Assigned --> InProgress: technician starts
  InProgress --> Resolved: technician finishes
  Resolved --> Closed: student confirms
  Resolved --> Reopened: student reopens
  Reopened --> Assigned: admin reassigns
  Reopened --> InProgress: technician restarts
  Closed --> [*]
```

## Entity relationships

```mermaid
erDiagram
  users ||--o{ tickets : "requests / is assigned"
  locations ||--o{ locations : "parent"
  locations ||--o{ assets : contains
  locations ||--o{ tickets : "reported at"
  assets ||--o{ tickets : "linked to"
  assets ||--o{ pm_schedules : "maintained by"
  tickets ||--o{ ticket_events : "history"
  tickets ||--o{ ticket_comments : has
  tickets ||--o{ attachments : has
  users ||--o{ notifications : receives
```

## Key design decisions
- **Role scoping in SQL**: students only see their own tickets, technicians only assigned ones; enforced in every query, not just the UI.
- **Status transitions are a table** (`TRANSITIONS` in `routes/tickets.js`) mapping from/to status to allowed roles; every change writes a `ticket_events` row.
- **AI is optional**: Claude failures, timeouts or a missing key return "no suggestion" and never block ticket creation.
- **Rate limiter fails open**: if Redis is down, requests pass instead of locking everyone out.
- **PM job is idempotent**: `FOR UPDATE SKIP LOCKED`, and missed runs are skipped rather than flooding tickets.
- **SLA hours**: Critical 4h, High 24h, Medium 48h, Low 7 days.
