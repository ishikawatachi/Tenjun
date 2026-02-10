# Threat Model Platform - Docker Configuration

## Quick Reference

### Start Services
```bash
# Production
docker-compose up -d

# Development with hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Build and start
docker-compose up -d --build
```

### Stop Services
```bash
# Stop all
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop specific service
docker-compose stop api
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f analysis

# Last N lines
docker-compose logs --tail=50 api
```

### Service Management
```bash
# Restart service
docker-compose restart api

# Rebuild service
docker-compose up -d --build api

# Scale service
docker-compose up -d --scale api=3

# Execute command in container
docker-compose exec api sh
docker-compose exec analysis bash
```

### Health Checks
```bash
# Check all services
docker-compose ps

# API health
curl https://localhost/api/health

# Analysis health
curl https://localhost/analysis/health

# Frontend
curl https://localhost/
```

### Database Operations
```bash
# Manual backup
docker-compose exec db-backup sh /backup-db.sh

# List backups
ls -lh data/backups/

# Access database
sqlite3 data/db/threat-model.db
```

### Resource Limits

| Service  | CPU Limit | Memory Limit | Memory Reserved |
|----------|-----------|--------------|-----------------|
| API      | Unlimited | 1 GB         | 512 MB          |
| Analysis | 50%       | 2 GB         | 512 MB          |
| Nginx    | Unlimited | 256 MB       | 128 MB          |

### Network Configuration

- Network: `threat-model-network` (bridge)
- Subnet: `172.28.0.0/16`

### Volume Mounts

| Volume          | Purpose              | Size Limit |
|-----------------|----------------------|------------|
| db-data         | Database files       | 10 GB      |
| db-backups      | Database backups     | Unlimited  |
| api-logs        | API logs             | Rotated    |
| analysis-logs   | Analysis logs        | Rotated    |
| analysis-cache  | LLM response cache   | Unlimited  |
| frontend-build  | Built static files   | ~100 MB    |
| nginx-logs      | Nginx access/error   | Rotated    |
| nginx-cache     | Nginx cache          | Auto-clean |

### Environment Variables

See `.env.example` for all available variables.

Key variables:
- `DB_ENCRYPTION_KEY` - Database encryption (32+ chars)
- `JWT_SECRET` - JWT token signing (32+ chars)
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `LLM_PROVIDER` - openai|anthropic
- `LOG_LEVEL` - debug|info|warn|error

### Ports

| Service   | Internal | External | Protocol |
|-----------|----------|----------|----------|
| API       | 3001     | -        | HTTP     |
| Analysis  | 3002     | -        | HTTP     |
| Nginx     | 80       | 80       | HTTP     |
| Nginx SSL | 443      | 443      | HTTPS    |

All services are accessed through Nginx reverse proxy.

### Troubleshooting

**Container won't start:**
```bash
docker-compose logs <service>
docker-compose up <service>
```

**Out of memory:**
```bash
docker system prune -a
docker volume prune
```

**Permission denied:**
```bash
sudo chown -R $USER:$USER data/
chmod 700 data/db data/backups
```

**SSL errors:**
```bash
cd infra/docker
rm -f ssl/*.pem
./generate-ssl.sh
docker-compose restart nginx
```

**Database locked:**
```bash
docker-compose down
rm -f data/db/threat-model.db-journal
docker-compose up -d
```

### Monitoring

View container stats:
```bash
docker stats
```

View detailed service info:
```bash
docker-compose config
docker inspect threat-model-api
```

### Production Deployment

1. Update `.env` with production values
2. Replace SSL certificates with proper ones
3. Configure firewall rules
4. Set up automated backups
5. Enable monitoring and alerting
6. Review security settings in nginx.conf
7. Set appropriate resource limits
8. Configure log rotation
9. Test disaster recovery procedures
10. Document runbooks

### Backup & Restore

**Automated Backups:**
- Frequency: Daily at midnight
- Retention: Last 7 backups
- Location: `data/backups/`

**Manual Backup:**
```bash
docker-compose exec db-backup sh /backup-db.sh
```

**Restore:**
```bash
# 1. Stop services
docker-compose down

# 2. Restore database
gunzip -c data/backups/threat-model_20260210_120000.db.gz > data/db/threat-model.db

# 3. Start services
docker-compose up -d
```

### Security Best Practices

- [ ] Change all default secrets
- [ ] Use strong passwords (32+ characters)
- [ ] Enable HTTPS only
- [ ] Configure rate limiting
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Implement backup verification
- [ ] Use Docker secrets for sensitive data
- [ ] Enable container scanning
- [ ] Restrict network access

### Performance Tuning

**API Service:**
- Increase memory if handling large requests
- Add more replicas for load balancing
- Enable clustering for Node.js

**Analysis Service:**
- Adjust CPU limit based on LLM usage
- Increase cache size for better performance
- Use connection pooling

**Database:**
- Regular VACUUM operations
- Index optimization
- Consider PostgreSQL for high load

**Nginx:**
- Tune worker processes
- Adjust buffer sizes
- Enable HTTP/2 and compression
