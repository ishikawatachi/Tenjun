# 🚀 Release System Guide

## How Releases Work

Your repository now has **automatic release creation** via GitHub Actions!

### 📦 What Gets Released

When you merge to `main`, GitHub automatically:

1. ✅ Creates a new version tag (e.g., `v1.0.0`, `v1.0.1`)
2. ✅ Packages installer files into downloadable archives:
   - `threat-model-platform-vX.Y.Z.tar.gz` (Linux/macOS)
   - `threat-model-platform-vX.Y.Z.zip` (Windows)
3. ✅ Generates SHA256 checksums for security verification
4. ✅ Creates release notes with changelog
5. ✅ Publishes to GitHub Releases page

### 📋 Package Contents

Each release includes:

```
threat-model-platform-vX.Y.Z/
├── install.sh              # Linux/macOS installer
├── install.ps1             # Windows PowerShell installer
├── install.bat             # Windows batch launcher
├── setup.sh                # Alternative setup script
├── docker-compose.yml      # Docker configuration
├── docker-compose.dev.yml  # Development Docker config
├── .env.example            # Environment variables template
├── README.md               # Main documentation
├── QUICKSTART.md           # Quick start guide
├── validate-config.sh      # Configuration validator
├── verify-installation.sh  # Installation test suite
└── infra/                  # Infrastructure files
    ├── docker/
    └── k8s/
```

## 🎯 Usage Workflows

### Workflow 1: Automatic Release (Recommended)

**For normal development:**

```bash
# 1. Work on develop branch
git checkout develop
git checkout -b feature/my-awesome-feature
# ... make changes ...
git commit -am "feat: Add awesome feature"

# 2. Merge to develop
git checkout develop
git merge feature/my-awesome-feature
git push origin develop

# 3. Test thoroughly on develop
./verify-installation.sh

# 4. When ready for production, merge to main
git checkout main
git merge develop
git push origin main

# 🎉 GitHub Actions automatically:
# - Creates release v1.0.1 (if previous was v1.0.0)
# - Packages everything
# - Publishes to: https://github.com/ishikawatachi/Tenjun/releases
```

### Workflow 2: Manual Release (For Major Versions)

**For major version bumps (v2.0.0, v3.0.0):**

1. Go to: https://github.com/ishikawatachi/Tenjun/actions/workflows/release.yml
2. Click **"Run workflow"**
3. Enter version: `v2.0.0`
4. Choose if pre-release: ☐ No
5. Click **"Run workflow"**
6. Wait ~2 minutes
7. Release appears at: https://github.com/ishikawatachi/Tenjun/releases/tag/v2.0.0

## 📥 How Users Download

### Direct Download Links

**Latest Release (always current):**
```bash
# Linux/macOS
wget https://github.com/ishikawatachi/Tenjun/releases/latest/download/threat-model-platform-v1.0.0.tar.gz

# Or with curl
curl -L -O https://github.com/ishikawatachi/Tenjun/releases/latest/download/threat-model-platform-v1.0.0.tar.gz
```

**Windows:**
- Visit: https://github.com/ishikawatachi/Tenjun/releases/latest
- Download: `threat-model-platform-vX.Y.Z.zip`

### Installation from Release

**Linux/macOS:**
```bash
# Download and verify
wget https://github.com/ishikawatachi/Tenjun/releases/latest/download/threat-model-platform-v1.0.0.tar.gz
wget https://github.com/ishikawatachi/Tenjun/releases/latest/download/threat-model-platform-v1.0.0.tar.gz.sha256

# Verify checksum
sha256sum -c threat-model-platform-v1.0.0.tar.gz.sha256

# Extract and install
tar -xzf threat-model-platform-v1.0.0.tar.gz
cd threat-model-platform-v1.0.0/
./install.sh

# Access at https://localhost
```

**Windows:**
```powershell
# Download ZIP from releases page
# Right-click → Extract All
cd threat-model-platform-v1.0.0
.\install.ps1
```

## 🏷️ Version Numbering

Uses **Semantic Versioning (SemVer):**

```
v1.2.3
│ │ │
│ │ └── PATCH: Bug fixes (auto-incremented)
│ └──── MINOR: New features, backward compatible
└────── MAJOR: Breaking changes
```

**Examples:**
- `v1.0.0` → `v1.0.1` - Bug fix (automatic)
- `v1.0.1` → `v1.1.0` - New feature (manual)
- `v1.1.0` → `v2.0.0` - Breaking change (manual)

## 🚫 What Doesn't Trigger a Release

Changes to these paths **don't** auto-create releases:

- `docs/**` - GitHub Pages documentation
- `*.md` - Markdown files (README, etc.)
- `.github/**` - GitHub Actions workflows

**Why?** Documentation updates shouldn't create new software versions.

## 📝 Release Notes

Auto-generated release notes include:

```markdown
## 🚀 Threat Modeling Platform v1.0.0

### 📦 What's Included
- Installers for all platforms
- Complete documentation
- Docker setup

### ✨ Key Features
- AI-Powered Analysis
- Jira Integration
- STRIDE Analysis
- [... full feature list ...]

### 📥 Installation
[... installation instructions ...]

### 📝 Changelog
- feat: Add new threat scanner (abc123)
- fix: Fix database connection issue (def456)
- docs: Update API reference (ghi789)

### 🔒 Security
[... security information ...]

### ✅ Verification
[... checksum verification instructions ...]
```

## 🎬 First Release

Want to create your first release right now?

```bash
# Option 1: Merge to main (triggers automatic release)
git checkout main
git merge develop
git push origin main

# Watch the magic happen at:
# https://github.com/ishikawatachi/Tenjun/actions

# Option 2: Manual release with custom version
# Go to: https://github.com/ishikawatachi/Tenjun/actions/workflows/release.yml
# Click "Run workflow"
# Enter: v1.0.0
# Click "Run workflow"
```

## 🔍 Monitoring Releases

### View All Releases
https://github.com/ishikawatachi/Tenjun/releases

### View Workflow Runs
https://github.com/ishikawatachi/Tenjun/actions/workflows/release.yml

### Latest Release Badge
Add to your README:
```markdown
[![Latest Release](https://img.shields.io/github/v/release/ishikawatachi/Tenjun)](https://github.com/ishikawatachi/Tenjun/releases/latest)
```

## ✅ Best Practices

1. **Test on develop first** - Always test before merging to main
2. **Use meaningful commits** - They appear in release notes
3. **Tag major versions manually** - v2.0.0, v3.0.0, etc.
4. **Review auto-releases** - Edit notes if needed on GitHub
5. **Keep checksums** - Always provide SHA256 for security

## 🆘 Troubleshooting

### Release Not Created

**Check:**
```bash
# 1. View workflow logs
# https://github.com/ishikawatachi/Tenjun/actions

# 2. Check if push was to main
git log --oneline -5

# 3. Check if files changed were excluded
git diff HEAD~1 --name-only
```

### Wrong Version Number

**Fix:**
```bash
# Delete bad release on GitHub (UI or CLI)
gh release delete v1.0.0

# Delete tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Trigger new release with correct version
# Use manual workflow dispatch
```

### Missing Files in Archive

**Fix:**
1. Edit `.github/workflows/release.yml`
2. Add file to "Create release archive" step:
   ```yaml
   cp your-new-file.sh release/$ARCHIVE_NAME/
   ```
3. Commit and push to trigger new release

## 📊 Release Analytics

GitHub tracks:
- Download counts per asset
- Release views
- Tag creation dates
- Download trends

View at: https://github.com/ishikawatachi/Tenjun/releases

## 🔗 Quick Links

- **Releases Page:** https://github.com/ishikawatachi/Tenjun/releases
- **Latest Release:** https://github.com/ishikawatachi/Tenjun/releases/latest
- **Workflow:** https://github.com/ishikawatachi/Tenjun/actions/workflows/release.yml
- **Actions Status:** https://github.com/ishikawatachi/Tenjun/actions

---

**🎉 Your release system is ready to go!**

Next step: Merge to main to create your first release, or use manual dispatch to set a custom version number.
