# Deployment Strategy

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose -f docker/docker-compose.yml up -d postgres redis

# 3. Set environment
cp .env.example .env
# Edit DATABASE_URL and REDIS_URL to point to local Docker services
# Set ALLOW_UNAUTHENTICATED=true for local dev (optional)

# 4. Migrate database
pnpm db:migrate
pnpm db:seed

# 5. Run dev servers
pnpm dev
```

Seed data includes:
- OpenAI, Anthropic, and Ollama providers with models
- 4 routing rules (code → Claude, privacy → local, cheap → Ollama, reasoning → Opus)
- 3 agents (Researcher, Writer, Coder) with tools
- 1 workflow (Research & Write)
- 5 marketplace presets (GPT-4o, Claude 3.5 Sonnet, Llama 3.1 8B, Claude 3 Opus, Mistral)
- Default monthly budget

## Self-Hosted (Docker Compose)

The simplest production deployment:

```bash
# Clone
git clone https://github.com/modelmesh/modelmesh.git
cd modelmesh

# Configure
cp .env.example .env
# Edit .env with your keys and settings

# Deploy
docker compose -f docker/docker-compose.yml up -d
```

Services exposed:
- Gateway: `http://localhost:3000`
- Dashboard: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Kubernetes

For larger deployments:

```yaml
# k8s/gateway-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: modelmesh-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: modelmesh-gateway
  template:
    metadata:
      labels:
        app: modelmesh-gateway
    spec:
      containers:
        - name: gateway
          image: ghcr.io/modelmesh/gateway:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: modelmesh-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: modelmesh-secrets
                  key: redis-url
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: modelmesh-gateway
spec:
  selector:
    app: modelmesh-gateway
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

## Cloud Providers

### AWS

- **ECS/Fargate** for gateway containers
- **RDS PostgreSQL** for database
- **ElastiCache Redis** for caching
- **Application Load Balancer** for ingress
- **Secrets Manager** for API keys

### GCP

- **Cloud Run** for gateway (serverless scaling)
- **Cloud SQL PostgreSQL**
- **Memorystore Redis**
- **Cloud Load Balancing**

### Azure

- **Container Apps** for gateway
- **Azure Database for PostgreSQL**
- **Azure Cache for Redis**
- **Application Gateway**

## Reverse Proxy Setup

### Caddy (recommended for simplicity)

```caddyfile
modelmesh.example.com {
    reverse_proxy localhost:3000
    tls email@example.com
}

dashboard.modelmesh.example.com {
    reverse_proxy localhost:3001
    tls email@example.com
}
```

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name modelmesh.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## Security Checklist

- [ ] HTTPS enabled (TLS 1.3)
- [ ] API keys stored in secret manager (not env files)
- [ ] Database encrypted at rest
- [ ] Redis password protected
- [ ] Gateway behind firewall (not exposed to internet without auth)
- [ ] Rate limiting enabled
- [ ] CORS restricted to known origins
- [ ] Health checks configured for auto-restart
- [ ] Log aggregation (Datadog, Grafana, etc.)
- [ ] Backup strategy for PostgreSQL
- [ ] RBAC enforced (do not use ALLOW_UNAUTHENTICATED in production)
- [ ] Audit logging reviewed regularly
- [ ] Team invitations expire after 7 days

## Scaling Guide

### Horizontal Scaling

The gateway is stateless. Scale by increasing replicas:

```bash
# Docker Compose
docker compose up -d --scale gateway=5

# Kubernetes
kubectl scale deployment modelmesh-gateway --replicas=5
```

### Database

- Use connection pooling (PgBouncer) for high concurrency
- Partition `usage_logs` table by month for large workloads
- Enable read replicas for analytics queries

### Redis

- Use Redis Cluster for high availability
- Set appropriate TTLs for cached data
- Monitor memory usage and eviction policies

### Performance Tuning

- **Gateway workers**: Match CPU cores
- **Health check interval**: Increase to 60s for stable providers
- **Request timeout**: 30s default, increase for large context
- **Stream buffering**: Tune for your network latency

## Enterprise Setup

### Enabling RBAC

1. Set `ALLOW_UNAUTHENTICATED=false` (or unset) in production
2. Create a user in the `User` table (or use OAuth/GitHub login when SSO is added)
3. Create a `UserSession` token for dashboard access
4. Create teams via the dashboard or API
5. Invite members via `/v1/teams/:id/invitations`
6. Assign roles: `owner`, `admin`, `developer`, `viewer`

### Team Provider Overrides

Each team can override provider settings:
- Custom base URL (e.g. internal Ollama endpoint)
- Custom API key (e.g. team-specific key)
- Enable/disable specific providers per team
- Custom weight for routing priority

## Monitoring

Recommended stack:
- **Prometheus** + **Grafana** for metrics
- **Loki** for log aggregation
- **Jaeger** for distributed tracing (optional)
- **Uptime Kuma** or **Pingdom** for external health checks

Key metrics to alert on:
- Gateway error rate > 1%
- Average latency > 5s
- Provider health degradation
- Database connection pool saturation
- Redis memory usage > 80%
