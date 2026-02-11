# 🚀 Quick Start Guide

## Installation (5 minutes)

### Linux / macOS
```bash
./install.sh
```

### Windows
```powershell
.\install.ps1
```
Or double-click: `install.bat`

---

## Verification

```bash
# Validate configuration
./validate-config.sh

# Run full test suite
./verify-installation.sh
```

---

## Access Application

- **Frontend**: https://localhost
- **API Docs**: https://localhost/api-docs
- **API Health**: https://localhost/api/health

---

## Optional Features

### Enable LLM (AI-Powered Analysis)
Edit `.env`:
```bash
ENABLE_LLM=true
OPENAI_API_KEY=sk-your-key-here
```

### Enable Jira Integration
Edit `.env`:
```bash
ENABLE_JIRA=true
JIRA_HOST=your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-token-here
```

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose build
docker-compose up -d

# Service status
docker-compose ps

# Restart specific service
docker-compose restart api
```

---

## File Locations

- **Configuration**: `.env`
- **Database**: `data/threat-models.db`
- **Logs**: `logs/`
- **Backups**: `data/backups/`
- **JWT Keys**: `.keys/private.pem`, `.keys/public.pem`

---

## Troubleshooting

### Services won't start
```bash
docker-compose logs -f api
docker-compose logs -f analysis
```

### Configuration issues
```bash
./validate-config.sh
```

### Database problems
```bash
# Recreate database
rm data/threat-models.db
docker-compose restart db-init
```

### Permission denied on scripts
```bash
chmod +x *.sh
```

---

## Security Notes

- ✅ All keys generated with cryptographic randomness
- ✅ JWT uses RSA-2048 asymmetric encryption
- ✅ Database encrypted with AES-256
- ✅ SSL enabled (self-signed for dev)
- ✅ .env file gitignored by default

**Never commit `.env` or `.keys/` to version control!**

---

## Documentation

- Full implementation details: [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)
- Jira integration: `backend/docs/JIRA_INTEGRATION.md`
- Docker deployment: `docs/deployment/DOCKER.md`

---

## Support

If verification tests fail:
1. Run `./validate-config.sh` for detailed diagnostics
2. Check specific error messages
3. Review logs: `docker-compose logs -f`

---

**Ready to use!** Start with: `./install.sh`
