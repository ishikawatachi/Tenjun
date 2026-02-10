# Threat Model Platform

A production-ready threat modeling platform with AI-powered analysis capabilities.

## 🏗️ Architecture

- **Node.js API Backend** (Express) - RESTful API with JWT authentication
- **Python Analysis Service** (Flask) - AI-powered threat analysis using OpenAI/Anthropic
- **React Frontend** (TypeScript) - Modern SPA interface
- **SQLite Database** - Encrypted persistent storage
- **Nginx** - Reverse proxy and load balancer

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- 8GB RAM minimum
- 20GB disk space

### Setup

1. **Clone and configure environment:**
```bash
cd ~/threat-model-platform
cp .env.example .env
# Edit .env with your configuration
nano .env
```

2. **Generate secure keys:**
```bash
# Generate DB encryption key
openssl rand -hex 32

# Generate JWT secret
openssl rand -hex 32
```

3. **Add API keys to .env:**
```env
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

4. **Start services:**
```bash
# Create data directories
mkdir -p data/db data/backups

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

5. **Access the platform:**
- Frontend: https://localhost
- API: https://localhost/api
- Analysis: https://localhost/analysis

## 📋 Service Details

### Node.js API Service (Port 3001)
- **Health Check:** `GET /health`
- **Memory Limit:** 1GB
- **Features:** JWT auth, helmet security, CORS, request logging

### Python Analysis Service (Port 3002)
- **Health Check:** `GET /health`
- **Analyze Endpoint:** `POST /analyze`
- **CPU Limit:** 50%
- **Features:** LLM integration, caching, rate limiting

### Database
- **Type:** SQLite with encryption
- **Location:** `./data/db/threat-model.db`
- **Backups:** Automated daily backups to `./data/backups`
- **Retention:** Last 7 backups

### Nginx Proxy
- **HTTP:** Port 80 (redirects to HTTPS)
- **HTTPS:** Port 443
- **Features:** SSL/TLS, rate limiting, caching, compression

## 🔧 Management Commands

### Start/Stop Services
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart api

# View service status
docker-compose ps
```

### Logs & Monitoring
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f analysis

# View last 100 lines
docker-compose logs --tail=100
```

### Database Management
```bash
# Manual backup
docker-compose exec db-backup sh /backup-db.sh

# Restore from backup
# 1. Stop services
docker-compose down

# 2. Restore backup
gunzip -c data/backups/threat-model_YYYYMMDD_HHMMSS.db.gz > data/db/threat-model.db

# 3. Start services
docker-compose up -d
```

### Scale Services
```bash
# Scale API service to 3 instances
docker-compose up -d --scale api=3

# Update nginx upstream configuration accordingly
```

## 🔐 Security

### Production Checklist

- [ ] Change all default secrets in `.env`
- [ ] Use strong encryption keys (32+ characters)
- [ ] Replace self-signed SSL certificates with proper ones
- [ ] Enable HTTPS only (disable HTTP redirect bypass)
- [ ] Configure firewall rules
- [ ] Set up log monitoring and alerts
- [ ] Enable Docker secrets for sensitive data
- [ ] Regular security updates
- [ ] Implement backup verification
- [ ] Configure rate limiting per your needs

### SSL Certificates

For development (self-signed):
```bash
cd infra/docker
./generate-ssl.sh
```

For production (Let's Encrypt):
```bash
# Install certbot
apt-get install certbot

# Generate certificate
certbot certonly --standalone -d your-domain.com

# Update nginx.conf to point to Let's Encrypt certificates
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

## 📊 Monitoring & Health Checks

All services expose health check endpoints:
- API: `http://api:3001/health`
- Analysis: `http://analysis:3002/health`
- Nginx: `http://localhost/health`

Health check parameters:
- Interval: 30 seconds
- Timeout: 10 seconds
- Retries: 3
- Start period: 40 seconds

## 🐛 Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Check memory
free -h

# Recreate containers
docker-compose down -v
docker-compose up -d --build
```

### Database locked
```bash
# Stop all services
docker-compose down

# Check for stale connections
lsof data/db/threat-model.db

# Restart services
docker-compose up -d
```

### SSL certificate errors
```bash
# Regenerate certificates
cd infra/docker
rm -f ssl/*.pem
./generate-ssl.sh

# Restart nginx
docker-compose restart nginx
```

## 📦 Development

### Local Development (without Docker)

**Backend API:**
```bash
cd backend
npm install
npm run dev
```

**Analysis Service:**
```bash
cd backend/analysis
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## 🧪 Testing

```bash
# Test API health
curl http://localhost:3001/health

# Test analysis service
curl http://localhost:3002/health

# Test analysis endpoint
curl -X POST http://localhost:3002/analyze \
  -H "Content-Type: application/json" \
  -d '{"system_description": "Web application with user auth"}'
```

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📧 Support

For issues and questions, please open a GitHub issue.
