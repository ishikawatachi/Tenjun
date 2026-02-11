# 🎯 Quick Setup Guide

## ✅ Both Issues Fixed!

### Issue #1: Localhost "file not found" 
**Cause:** Docker services not running

### Issue #2: GitHub Pages broken links
**Cause:** Links were absolute paths (`/demo.html`) instead of relative (`./demo.html`)
**Status:** ✅ FIXED - All HTML files now use relative paths

---

## 🚀 For GitHub Pages (https://ishikawatachi.github.io/Tenjun/)

### 1. Commit and Push the Changes

```bash
# Add all the fixed files
git add docs/

# Commit with message
git commit -m "Fix GitHub Pages navigation - use relative paths for /Tenjun/ subpath"

# Push to GitHub
git push origin main
```

### 2. Enable GitHub Pages (if not already done)

1. Go to: https://github.com/ishikawatachi/Tenjun/settings/pages
2. **Source:** Deploy from a branch
3. **Branch:** `main` (or `master`)
4. **Folder:** `/docs`
5. Click **Save**

### 3. Wait 1-2 minutes, then visit:
**https://ishikawatachi.github.io/Tenjun/**

All navigation links will now work correctly! ✨

---

## 💻 For Localhost (Full Platform)

### Option 1: Quick Start (Recommended)

```bash
# Run the automated installer
./install.sh
```

The installer will:
- Check Docker is running
- Generate secure keys
- Create .env configuration
- Build and start all services
- Verify health checks

### Option 2: Manual Start (if already installed)

```bash
# Just start the services
docker-compose up -d

# Wait 30 seconds for services to be ready
sleep 30

# Check status
docker-compose ps
```

### Access Localhost

Once services are running:
- **Frontend:** https://localhost
- **API Health:** https://localhost/api/health
- **Logs:** `docker-compose logs -f`

**Note:** Browser will warn about self-signed SSL certificate. Click "Advanced" → "Proceed to localhost".

### Stop Services

```bash
docker-compose down
```

---

## 🔍 Troubleshooting

### GitHub Pages shows 404
- Wait 2-3 minutes after pushing (GitHub needs time to rebuild)
- Check settings: https://github.com/ishikawatachi/Tenjun/settings/pages
- Ensure folder is set to `/docs`

### Localhost still shows error
```bash
# Check if Docker is running
docker ps

# If empty, start Docker Desktop or:
sudo systemctl start docker

# Then try again:
docker-compose up -d
```

### Services won't start
```bash
# Check for port conflicts
sudo lsof -i :80 -i :443 -i :3001 -i :5000

# View detailed logs
docker-compose logs

# Restart from scratch
docker-compose down -v
./install.sh
```

---

## 📚 What's Available

### GitHub Pages Demo (No Installation)
✅ Interactive threat modeling form  
✅ 50+ pre-coded threat patterns  
✅ Client-side analysis (instant results)  
✅ JSON export  
✅ Architecture diagrams  
✅ Complete documentation  

### Full Platform (Local Installation)
✅ Everything above PLUS:  
✅ AI-powered analysis (GPT-4/Claude)  
✅ Terraform/Kubernetes IaC parsing  
✅ Dynamic DFD generation  
✅ Jira ticket creation  
✅ GitHub repository scanning  
✅ Database storage  
✅ Multi-user support  

---

## 🎉 Next Steps

1. **Push to GitHub** (see commands above)
2. **Visit:** https://ishikawatachi.github.io/Tenjun/
3. **Try the demo** - works immediately, no backend needed!
4. **For localhost** - run `./install.sh` when ready

All links are now relative and will work perfectly at the /Tenjun/ subpath! 🚀
