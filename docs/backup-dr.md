# Backup & Disaster Recovery (DR) Strategy

## 1. High Availability (HA) Target: 99.95%

To achieve **99.95% availability** (less than 4.38 hours of unscheduled downtime annually), the Amrutam Telemedicine Backend is architected across multiple Availability Zones (Multi-AZ):

- **API Pods**: Minimum 3 replicas across separate nodes and AZs managed by Kubernetes Horizontal Pod Autoscaler (HPA).
- **PostgreSQL**: Multi-AZ primary-standby with synchronous streaming replication and automatic failover managed by Patroni or AWS Aurora / GCP Cloud SQL HA.
- **Redis**: Redis Sentinel or AWS ElastiCache cluster with multi-AZ failover.

---

## 2. Recovery Objectives

| Metric | Target | Rationale |
|---|---|---|
| **Recovery Point Objective (RPO)** | **$\le$ 5 minutes** | Maximum allowable data loss in catastrophic disaster |
| **Recovery Time Objective (RTO)** | **$\le$ 30 minutes** | Maximum allowable downtime until service is restored |

---

## 3. Database Backup & Point-in-Time Recovery (PITR)

### Continuous WAL Archiving
PostgreSQL Write-Ahead Logs (WAL) are streamed continuously to redundant cross-region cloud object storage (e.g. AWS S3 Glacier Instant Retrieval / Google Cloud Storage):
```ini
archive_mode = on
archive_command = 'envdir /etc/wal-e.d/env wal-g wal-push %p'
archive_timeout = 60
```
This guarantees that transactions are safely persisted outside the primary database zone within 60 seconds of commit, satisfying the **RPO $\le$ 5 min** requirement.

### Daily Base Backups
- Automated full physical base backups taken daily at 02:00 UTC using `pg_basebackup` or `wal-g backup-push`.
- 30-day retention policy for base backups; 7-day retention for hourly differential snapshots.
- Immutable WORM (Write Once, Read Many) bucket policies protect backup snapshots from ransomware tampering.

### Point-in-Time Recovery Procedure
To restore the database to a specific second before a corruption event:
1. Provision target PostgreSQL instance in recovery AZ or region.
2. Restore latest daily base backup:
   ```bash
   wal-g backup-fetch /var/lib/postgresql/data LATEST
   ```
3. Configure `recovery.signal` and target restore timestamp:
   ```sql
   restore_command = 'wal-g wal-fetch %f %p'
   recovery_target_time = '2026-10-27 10:15:00 UTC'
   recovery_target_action = 'promote'
   ```
4. Start PostgreSQL engine to replay WAL files up to the target timestamp.
5. Redirect PgBouncer connection pooler to the restored instance.

---

## 4. Disaster Recovery Drills & Validation

- **Quarterly Automated Restore Drills**: A dedicated CI workflow restores the latest base backup + WAL into an ephemeral staging environment every quarter and executes automated integration tests to verify data integrity.
- **Failover Testing**: Chaos engineering tests (killing active primary DB pod) run biannually to verify automatic failover completes in under 30 seconds.
