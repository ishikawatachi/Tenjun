#!/bin/bash
# ============================================
# Threat Modeling Platform - Cross-Platform Installer
# ============================================
# Supports: Linux, macOS, WSL
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logo
echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     THREAT MODELING PLATFORM - INSTALLER v1.0                ║
║                                                               ║
║     Comprehensive security threat analysis & modeling        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# ============================================
# Step 1: System Validation
# ============================================
echo -e "${BLUE}[1/8] System Validation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo -e "${GREEN}✓${NC} Operating System: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo -e "${GREEN}✓${NC} Operating System: macOS"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
    echo -e "${GREEN}✓${NC} Operating System: Windows (WSL/Git Bash)"
else
    echo -e "${RED}✗${NC} Unsupported OS: $OSTYPE"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker is not installed"
    echo ""
    echo "Please install Docker:"
    echo "  • Linux:   https://docs.docker.com/engine/install/"
    echo "  • macOS:   https://docs.docker.com/desktop/mac/install/"
    echo "  • Windows: https://docs.docker.com/desktop/windows/install/"
    exit 1
fi
DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
echo -e "${GREEN}✓${NC} Docker installed: v$DOCKER_VERSION"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗${NC} Docker Compose is not installed"
    echo ""
    echo "Please install Docker Compose:"
    echo "  https://docs.docker.com/compose/install/"
    exit 1
fi
COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f4 | cut -d',' -f1)
echo -e "${GREEN}✓${NC} Docker Compose installed: v$COMPOSE_VERSION"

# Check OpenSSL
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}✗${NC} OpenSSL is not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} OpenSSL installed"

# Check disk space (need at least 2GB)
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}' | sed 's/G//')
if (( $(echo "$AVAILABLE_SPACE < 2" | bc -l) )); then
    echo -e "${YELLOW}⚠${NC}  Low disk space: ${AVAILABLE_SPACE}GB available (2GB+ recommended)"
fi

echo ""

# ============================================
# Step 2: Feature Selection
# ============================================
echo -e "${BLUE}[2/8] Feature Selection${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Select which optional features to enable:"
echo ""

# LLM Features
echo -e "${YELLOW}🤖 AI-Powered Threat Analysis${NC}"
echo "   Uses OpenAI GPT-4 or Anthropic Claude for intelligent threat detection"
echo "   Requires: API key from OpenAI ($\$20-100/month) or Anthropic"
read -p "   Enable LLM features? [y/N]: " ENABLE_LLM
ENABLE_LLM=${ENABLE_LLM:-n}
echo ""

# Jira Integration
echo -e "${YELLOW}🎫 Jira/Atlassian Integration${NC}"
echo "   Sync threats to Jira issues, bidirectional status updates"
echo "   Requires: Jira Cloud account + API token (free for personal use)"
read -p "   Enable Jira integration? [y/N]: " ENABLE_JIRA
ENABLE_JIRA=${ENABLE_JIRA:-n}
echo ""

# GitHub Integration
echo -e "${YELLOW}🐙 GitHub Integration${NC}"
echo "   Monitor repositories for security issues, analyze IaC"
echo "   Requires: GitHub personal access token (free)"
read -p "   Enable GitHub integration? [y/N]: " ENABLE_GITHUB
ENABLE_GITHUB=${ENABLE_GITHUB:-n}
echo ""

# ============================================
# Step 3: Configuration Generation
# ============================================
echo -e "${BLUE}[3/8] Configuration Generation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create .env from template
if [ -f .env ]; then
    echo -e "${YELLOW}⚠${NC}  .env file exists. Creating backup..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

cp .env.example .env
echo -e "${GREEN}✓${NC} Created .env configuration file"

# Generate database encryption key
echo "Generating database encryption key..."
DB_KEY=$(openssl rand -hex 32)
echo -e "${GREEN}✓${NC} DB Key: ${DB_KEY:0:12}...${DB_KEY: -12} (SHA256: $(echo -n $DB_KEY | sha256sum | cut -d' ' -f1 | head -c 12)...)"

# Generate RSA keypair for JWT
echo "Generating RSA keypair for JWT authentication..."
mkdir -p .keys
openssl genrsa -out .keys/private.pem 2048 2>/dev/null
openssl rsa -in .keys/private.pem -pubout -out .keys/public.pem 2>/dev/null
chmod 600 .keys/private.pem
chmod 644 .keys/public.pem

# Base64 encode keys
if [[ "$OS" == "macos" ]]; then
    JWT_PRIVATE_B64=$(base64 < .keys/private.pem | tr -d '\n')
    JWT_PUBLIC_B64=$(base64 < .keys/public.pem | tr -d '\n')
else
    JWT_PRIVATE_B64=$(base64 -w 0 < .keys/private.pem)
    JWT_PUBLIC_B64=$(base64 -w 0 < .keys/public.pem)
fi

JWT_PRIVATE_HASH=$(sha256sum .keys/private.pem | cut -d' ' -f1 | head -c 16)
JWT_PUBLIC_HASH=$(sha256sum .keys/public.pem | cut -d' ' -f1 | head -c 16)
echo -e "${GREEN}✓${NC} JWT Private Key (SHA256: $JWT_PRIVATE_HASH...)"
echo -e "${GREEN}✓${NC} JWT Public Key  (SHA256: $JWT_PUBLIC_HASH...)"

# Update .env file with generated keys
if [[ "$OS" == "macos" ]]; then
    sed -i '' "s|DB_ENCRYPTION_KEY=change-this-in-production-use-openssl-rand-hex-32|DB_ENCRYPTION_KEY=$DB_KEY|" .env
    sed -i '' "s|JWT_PRIVATE_KEY=|JWT_PRIVATE_KEY=$JWT_PRIVATE_B64|" .env
    sed -i '' "s|JWT_PUBLIC_KEY=|JWT_PUBLIC_KEY=$JWT_PUBLIC_B64|" .env
else
    sed -i "s|DB_ENCRYPTION_KEY=change-this-in-production-use-openssl-rand-hex-32|DB_ENCRYPTION_KEY=$DB_KEY|" .env
    sed -i "s|JWT_PRIVATE_KEY=|JWT_PRIVATE_KEY=$JWT_PRIVATE_B64|" .env
    sed -i "s|JWT_PUBLIC_KEY=|JWT_PUBLIC_KEY=$JWT_PUBLIC_B64|" .env
fi

echo ""

# ============================================
# Step 4: Optional Feature Configuration
# ============================================
echo -e "${BLUE}[4/8] Feature Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configure LLM
if [[ "$ENABLE_LLM" =~ ^[Yy]$ ]]; then
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/ENABLE_LLM=true/ENABLE_LLM=true/" .env
        sed -i '' "s/REACT_APP_ENABLE_LLM=true/REACT_APP_ENABLE_LLM=true/" .env
    else
        sed -i "s/ENABLE_LLM=true/ENABLE_LLM=true/" .env
        sed -i "s/REACT_APP_ENABLE_LLM=true/REACT_APP_ENABLE_LLM=true/" .env
    fi
    
    echo -e "${GREEN}✓${NC} LLM features enabled"
    echo ""
    echo "Select LLM provider:"
    echo "  1) OpenAI (GPT-4)"
    echo "  2) Anthropic (Claude)"
    read -p "Provider [1]: " LLM_CHOICE
    LLM_CHOICE=${LLM_CHOICE:-1}
    
    if [ "$LLM_CHOICE" == "2" ]; then
        if [[ "$OS" == "macos" ]]; then
            sed -i '' "s/LLM_PROVIDER=openai/LLM_PROVIDER=anthropic/" .env
            sed -i '' "s/LLM_MODEL=gpt-4/LLM_MODEL=claude-3-opus-20240229/" .env
        else
            sed -i "s/LLM_PROVIDER=openai/LLM_PROVIDER=anthropic/" .env
            sed -i "s/LLM_MODEL=gpt-4/LLM_MODEL=claude-3-opus-20240229/" .env
        fi
        echo ""
        read -p "Enter Anthropic API key: " ANTHROPIC_KEY
        if [[ "$OS" == "macos" ]]; then
            sed -i '' "s/ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here/ANTHROPIC_API_KEY=$ANTHROPIC_KEY/" .env
        else
            sed -i "s/ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here/ANTHROPIC_API_KEY=$ANTHROPIC_KEY/" .env
        fi
        echo -e "${GREEN}✓${NC} Anthropic configured"
    else
        echo ""
        read -p "Enter OpenAI API key: " OPENAI_KEY
        if [[ "$OS" == "macos" ]]; then
            sed -i '' "s/OPENAI_API_KEY=sk-your-openai-api-key-here/OPENAI_API_KEY=$OPENAI_KEY/" .env
        else
            sed -i "s/OPENAI_API_KEY=sk-your-openai-api-key-here/OPENAI_API_KEY=$OPENAI_KEY/" .env
        fi
        echo -e "${GREEN}✓${NC} OpenAI configured"
    fi
else
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/ENABLE_LLM=true/ENABLE_LLM=false/" .env
        sed -i '' "s/REACT_APP_ENABLE_LLM=true/REACT_APP_ENABLE_LLM=false/" .env
    else
        sed -i "s/ENABLE_LLM=true/ENABLE_LLM=false/" .env
        sed -i "s/REACT_APP_ENABLE_LLM=true/REACT_APP_ENABLE_LLM=false/" .env
    fi
    echo -e "${YELLOW}○${NC} LLM features disabled"
fi
echo ""

# Configure Jira
if [[ "$ENABLE_JIRA" =~ ^[Yy]$ ]]; then
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/ENABLE_JIRA=false/ENABLE_JIRA=true/" .env
        sed -i '' "s/REACT_APP_ENABLE_JIRA=false/REACT_APP_ENABLE_JIRA=true/" .env
    else
        sed -i "s/ENABLE_JIRA=false/ENABLE_JIRA=true/" .env
        sed -i "s/REACT_APP_ENABLE_JIRA=false/REACT_APP_ENABLE_JIRA=true/" .env
    fi
    
    echo -e "${GREEN}✓${NC} Jira integration enabled"
    echo ""
    read -p "Jira host (e.g., company.atlassian.net): " JIRA_HOST
    read -p "Jira email: " JIRA_EMAIL
    read -p "Jira API token: " JIRA_TOKEN
    read -p "Jira project key [SEC]: " JIRA_PROJECT
    JIRA_PROJECT=${JIRA_PROJECT:-SEC}
    
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/JIRA_HOST=your-company.atlassian.net/JIRA_HOST=$JIRA_HOST/" .env
        sed -i '' "s/JIRA_EMAIL=your-email@company.com/JIRA_EMAIL=$JIRA_EMAIL/" .env
        sed -i '' "s/JIRA_API_TOKEN=your-jira-api-token-here/JIRA_API_TOKEN=$JIRA_TOKEN/" .env
        sed -i '' "s/JIRA_PROJECT_KEY=SEC/JIRA_PROJECT_KEY=$JIRA_PROJECT/" .env
    else
        sed -i "s/JIRA_HOST=your-company.atlassian.net/JIRA_HOST=$JIRA_HOST/" .env
        sed -i "s/JIRA_EMAIL=your-email@company.com/JIRA_EMAIL=$JIRA_EMAIL/" .env
        sed -i "s/JIRA_API_TOKEN=your-jira-api-token-here/JIRA_API_TOKEN=$JIRA_TOKEN/" .env
        sed -i "s/JIRA_PROJECT_KEY=SEC/JIRA_PROJECT_KEY=$JIRA_PROJECT/" .env
    fi
    
    echo -e "${GREEN}✓${NC} Jira configured"
else
    echo -e "${YELLOW}○${NC} Jira integration disabled"
fi
echo ""

# Configure GitHub
if [[ "$ENABLE_GITHUB" =~ ^[Yy]$ ]]; then
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/ENABLE_GITHUB=false/ENABLE_GITHUB=true/" .env
    else
        sed -i "s/ENABLE_GITHUB=false/ENABLE_GITHUB=true/" .env
    fi
    
    echo -e "${GREEN}✓${NC} GitHub integration enabled"
    echo ""
    read -p "GitHub personal access token: " GITHUB_TOKEN
    
    if [[ "$OS" == "macos" ]]; then
        sed -i '' "s/GITHUB_TOKEN=ghp_your_github_personal_access_token/GITHUB_TOKEN=$GITHUB_TOKEN/" .env
    else
        sed -i "s/GITHUB_TOKEN=ghp_your_github_personal_access_token/GITHUB_TOKEN=$GITHUB_TOKEN/" .env
    fi
    
    echo -e "${GREEN}✓${NC} GitHub configured"
else
    echo -e "${YELLOW}○${NC} GitHub integration disabled"
fi
echo ""

# ============================================
# Step 5: Directory Setup
# ============================================
echo -e "${BLUE}[5/8] Directory Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

mkdir -p data/db data/backups logs
chmod 700 data/db data/backups
chmod 755 logs

echo -e "${GREEN}✓${NC} Created data/db (database storage)"
echo -e "${GREEN}✓${NC} Created data/backups (automatic backups)"
echo -e "${GREEN}✓${NC} Created logs (application logs)"
echo ""

# ============================================
# Step 6: SSL Certificate Generation
# ============================================
echo -e "${BLUE}[6/8] SSL Certificate Generation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f infra/docker/ssl/cert.pem ]; then
    cd infra/docker
    chmod +x generate-ssl.sh
    ./generate-ssl.sh
    cd ../..
    echo -e "${GREEN}✓${NC} SSL certificates generated (self-signed for development)"
else
    echo -e "${GREEN}✓${NC} SSL certificates already exist"
fi
echo ""

# ============================================
# Step 7: Build & Deploy
# ============================================
echo -e "${BLUE}[7/8] Build & Deploy${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Building Docker images (this may take 5-10 minutes)..."
docker-compose build --progress=plain

echo ""
echo "Starting services..."
docker-compose up -d

echo ""
echo "Waiting for services to initialize..."
sleep 15

# ============================================
# Step 8: Health Verification
# ============================================
echo ""
echo -e "${BLUE}[8/8] Health Verification${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_health() {
    local url=$1
    local name=$2
    if curl -f -k -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${RED}✗${NC} $name (not responding)"
        return 1
    fi
}

HEALTH_PASS=0
HEALTH_TOTAL=0

((HEALTH_TOTAL++))
if check_health "https://localhost/api/health" "API Backend"; then ((HEALTH_PASS++)); fi

((HEALTH_TOTAL++))
if check_health "https://localhost/analysis/health" "Analysis Service"; then ((HEALTH_PASS++)); fi

((HEALTH_TOTAL++))
if check_health "https://localhost/" "Frontend"; then ((HEALTH_PASS++)); fi

echo ""
echo "Health Status: $HEALTH_PASS/$HEALTH_TOTAL services healthy"

if [ $HEALTH_PASS -eq $HEALTH_TOTAL ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
else
    echo -e "${YELLOW}⚠ Some services failed health checks${NC}"
    echo "  This may be normal if services need more time to start."
    echo "  Check logs with: docker-compose logs -f"
fi

# ============================================
# Installation Complete
# ============================================
echo ""
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                  ✓ INSTALLATION COMPLETE!                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo "Application URLs:"
echo -e "  ${BLUE}→${NC} Frontend:  https://localhost"
echo -e "  ${BLUE}→${NC} API Docs:  https://localhost/api-docs"
echo -e "  ${BLUE}→${NC} API Health: https://localhost/api/health"
echo ""

echo "Enabled Features:"
if [[ "$ENABLE_LLM" =~ ^[Yy]$ ]]; then
    echo -e "  ${GREEN}✓${NC} AI-Powered Threat Analysis"
fi
if [[ "$ENABLE_JIRA" =~ ^[Yy]$ ]]; then
    echo -e "  ${GREEN}✓${NC} Jira Integration"
fi
if [[ "$ENABLE_GITHUB" =~ ^[Yy]$ ]]; then
    echo -e "  ${GREEN}✓${NC} GitHub Integration"
fi
echo ""

echo "Useful Commands:"
echo "  docker-compose ps              # View service status"
echo "  docker-compose logs -f         # View logs"
echo "  docker-compose logs -f api     # View API logs only"
echo "  docker-compose restart         # Restart all services"
echo "  docker-compose down            # Stop all services"
echo "  docker-compose up -d           # Start all services"
echo ""

echo "Security Keys (SAVE THESE):"
echo "  DB Encryption: $(echo -n $DB_KEY | sha256sum | cut -d' ' -f1 | head -c 16)... (in .env)"
echo "  JWT Private:   $JWT_PRIVATE_HASH... (in .keys/private.pem)"
echo "  JWT Public:    $JWT_PUBLIC_HASH... (in .keys/public.pem)"
echo ""

echo -e "${YELLOW}⚠  Note:${NC} Browser may warn about self-signed certificate."
echo "   This is normal for development. Click 'Advanced' and proceed."
echo ""
echo -e "${GREEN}Happy threat modeling! 🔒${NC}"
