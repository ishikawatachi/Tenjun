#!/bin/bash

# Branch Setup Script
# Sets up development branching strategy for the project

set -e

echo "🌳 Setting up Git branching strategy..."
echo ""

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Check if develop already exists
if git show-ref --verify --quiet refs/heads/develop; then
    echo "✅ 'develop' branch already exists"
else
    echo "Creating 'develop' branch from '$CURRENT_BRANCH'..."
    git checkout -b develop
    git push -u origin develop
    echo "✅ 'develop' branch created and pushed"
fi

echo ""
echo "🎯 Branching strategy setup complete!"
echo ""
echo "📋 Branch structure:"
echo "   main     ← Production (GitHub Pages)"
echo "   develop  ← Active development"
echo ""
echo "💡 Next steps:"
echo ""
echo "1. Set 'develop' as default branch on GitHub:"
echo "   https://github.com/ishikawatachi/Tenjun/settings/branches"
echo "   → Change default branch to: develop"
echo ""
echo "2. Protect 'main' branch (recommended):"
echo "   → Add branch protection rule for 'main'"
echo "   → Require pull requests before merging"
echo ""
echo "3. Start working on develop:"
echo "   git checkout develop"
echo "   git checkout -b feature/my-new-feature"
echo ""
echo "4. Read the full guide:"
echo "   cat BRANCHING_STRATEGY.md"
echo ""
