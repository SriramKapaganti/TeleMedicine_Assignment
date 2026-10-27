# High-Level Architecture Diagram

```mermaid
graph TD
    Client[Mobile / Web Client] -->|HTTPS / TLS| Edge[Nginx Ingress / Load Balancer]
    Edge -->|Edge Rate Limit 50r/s| API[Express API Pods (HPA Scaled 3-20)]

    subgraph "Modular Monolith API Layer"
        API --> Routes[Routes & Middleware]
        Routes --> Ctrls[Controllers]
        Ctrls --> Servs[Domain Services]
        Servs --> Repos[Repositories]
    end

    Servs -->|Read/Write Pool| PG[(PostgreSQL 16 Primary)]
    PG -.->|Streaming Replication| PGReplica[(PostgreSQL Read Replica)]
    Servs -->|Read Replica Queries| PGReplica

    Servs -->|Cache / Locks / Idempotency| Redis[(Redis 7 Cluster)]
    Servs -->|Enqueue Delayed Sagas| BullMQ[BullMQ Job Queues]

    BullMQ --> Worker[Background Worker Pods]
    Worker -->|Saga Compensation / Slot Release| PG
    Worker -->|Invalidate Slot Cache| Redis

    API -->|Scrape /metrics| Prom[Prometheus Server]
    Prom --> Grafana[Grafana Dashboards]
```
