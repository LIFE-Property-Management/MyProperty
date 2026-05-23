# Uptime Kuma

Uptime Kuma runs at **http://localhost:3002**. All configuration is UI-driven and persisted in the `uptime_kuma_data` Docker volume (SQLite).

On first start, create an admin account, then add the monitors below.

## Monitors

All URLs use internal Docker service names — Uptime Kuma is on the `myproperty-net` network alongside every other service.

| Monitor | Type | URL | Expected status |
|---|---|---|---|
| API — liveness | HTTP | `http://backend:8080/api/v1/health/live` | 200 |
| API — readiness | HTTP | `http://backend:8080/api/v1/health/ready` | 200 |
| Frontend | HTTP | `http://frontend:3000` | 200 |
| Keycloak | HTTP | `http://keycloak:8080/realms/MyProperty/.well-known/openid-configuration` | 200 |
| RabbitMQ | HTTP | `http://rabbitmq:15672` | 200 |
| Grafana | HTTP | `http://grafana:3000/api/health` | 200 |

Check interval: 60 seconds.

## Backup / restore

After adding monitors: **Settings → Backup → Export** and save the JSON as `infrastructure/uptime-kuma/monitors-backup.json`.

To restore on a fresh instance: **Settings → Backup → Import** and select that file.
