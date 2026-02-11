# Git Branching Strategy

## 🌳 Branch Structure

```
main              ← Stable, production-ready code (GitHub Pages served from here)
└── develop       ← Active development, integration branch
    ├── feature/* ← Individual features (create from develop)
    ├── bugfix/*  ← Bug fixes
    └── hotfix/*  ← Critical fixes (can branch from main)
```

## 📋 Branch Purposes

### `main` (Protected)
- **Purpose:** Production-ready, stable releases
- **GitHub Pages:** Served from `/docs` folder on this branch
- **Who merges:** Only team leads/maintainers
- **When:** After thorough testing on `develop`
- **Protected:** Require pull requests, reviews, CI passing

### `develop` (Default for development)
- **Purpose:** Integration branch for ongoing work
- **Stability:** Should build/run, but may have bugs
- **Who commits:** All developers
- **When:** Merge feature branches here first

### `feature/*` (Temporary)
- **Purpose:** Individual features or enhancements
- **Naming:** `feature/descriptive-name`
- **Lifespan:** Created from `develop`, merged back, then deleted
- **Examples:**
  - `feature/llm-improvements`
  - `feature/new-threat-scanner`
  - `feature/jira-v2-integration`

### `bugfix/*` (Temporary)
- **Purpose:** Non-critical bug fixes
- **Naming:** `bugfix/issue-description`
- **From:** `develop`
- **Examples:**
  - `bugfix/fix-db-connection`
  - `bugfix/cors-headers`

### `hotfix/*` (Temporary)
- **Purpose:** Critical production fixes
- **From:** `main` (emergency fixes for live site)
- **Merges to:** Both `main` AND `develop`
- **Examples:**
  - `hotfix/security-vulnerability`
  - `hotfix/broken-installer`

## 🚀 Workflows

### Daily Development

```bash
# 1. Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# 2. Work on it
# ... make changes ...
git add .
git commit -m "Implement new feature"
git push -u origin feature/my-new-feature

# 3. Ready to integrate
git checkout develop
git pull origin develop
git merge feature/my-new-feature
git push origin develop

# 4. Delete feature branch
git branch -d feature/my-new-feature
git push origin --delete feature/my-new-feature
```

### Release to Production

```bash
# 1. Test develop thoroughly
git checkout develop
./verify-installation.sh  # Run all tests

# 2. Merge to main
git checkout main
git pull origin main
git merge develop

# 3. Tag the release
git tag -a v1.0.0 -m "Release v1.0.0: New threat scanner"
git push origin main
git push origin v1.0.0

# 4. GitHub Pages automatically updates from main:/docs
# Visit: https://ishikawatachi.github.io/Tenjun/
```

### Emergency Hotfix

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Fix the issue
# ... make changes ...
git commit -am "Fix critical security issue"

# 3. Merge to BOTH main and develop
git checkout main
git merge hotfix/critical-security-fix
git push origin main

git checkout develop
git merge hotfix/critical-security-fix
git push origin develop

# 4. Delete hotfix branch
git branch -d hotfix/critical-security-fix
```

## 🎯 Benefits

### For Your Use Case

1. **Stable GitHub Pages:**
   - `main` branch serves https://ishikawatachi.github.io/Tenjun/
   - Only updated when you explicitly merge `develop` → `main`
   - Users always see working demo

2. **Experimental Development:**
   - Work freely on `develop` without breaking public site
   - Test installers without affecting production
   - Multiple people can work simultaneously

3. **Version Control:**
   - Tag releases: `v1.0.0`, `v1.1.0`, `v2.0.0`
   - Easy rollback if needed
   - Clear history of what changed when

## 📊 Example Workflow Timeline

```
Day 1: Create develop branch
  main: ✅ Stable (GitHub Pages working)
  develop: ✅ Created from main

Day 2-5: Work on new features
  feature/llm-v2: 🔨 Active work
  feature/ui-redesign: 🔨 Active work
  develop: ⏳ Waiting for merges
  main: ✅ Still stable (public site unchanged)

Day 6: Merge features to develop
  develop: ✅ Has new features, testing
  main: ✅ Still stable

Day 7: Test develop thoroughly
  develop: ✅ All tests pass
  main: ✅ Still stable

Day 8: Release to production
  main: ✅ Merged from develop, GitHub Pages updated with new features
  Tag: v1.1.0
```

## 🔧 Initial Setup

Run these commands to set up the branching strategy:

```bash
# 1. Create develop branch
git checkout -b develop
git push -u origin develop

# 2. (Optional) Set develop as default branch on GitHub
# Go to: https://github.com/ishikawatachi/Tenjun/settings/branches
# Change default branch to: develop
# This makes new PRs target develop by default

# 3. (Optional) Protect main branch
# Go to: https://github.com/ishikawatachi/Tenjun/settings/branches
# Add rule for: main
# ✅ Require pull request before merging
# ✅ Require status checks to pass
# ✅ Require branches to be up to date

# 4. Start working on develop
git checkout develop
# Now all new features start from here
```

## 📝 Commit Message Convention

Use clear, descriptive commit messages:

```bash
# Format: <type>(<scope>): <description>

# Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting, missing semicolons
refactor: Code restructure without behavior change
test:     Adding tests
chore:    Build process, dependencies

# Examples:
git commit -m "feat(analysis): Add GPT-4 Turbo support"
git commit -m "fix(installer): Fix Windows path handling"
git commit -m "docs(api): Update authentication examples"
```

## 🚨 Rules

1. **Never commit directly to `main`** - Always use pull requests
2. **Test before merging to main** - Run `./verify-installation.sh`
3. **Delete feature branches after merge** - Keep repo clean
4. **Tag all main releases** - Use semantic versioning (v1.0.0)
5. **Keep develop working** - Don't break the build

## 🆘 Recovery Commands

### Undo last commit (not pushed)
```bash
git reset --soft HEAD~1  # Keep changes
git reset --hard HEAD~1  # Discard changes
```

### Revert a pushed commit
```bash
git revert <commit-hash>
git push origin main
```

### Recover deleted branch
```bash
git reflog
git checkout -b recovered-branch <commit-hash>
```

---

**Current Status:**
- `main` branch: Serves GitHub Pages at https://ishikawatachi.github.io/Tenjun/
- `develop` branch: Not yet created (run commands above)

**Next Steps:**
1. Create `develop` branch
2. Make it default branch on GitHub
3. Start new features from `develop`
4. Merge to `main` only when ready for production
