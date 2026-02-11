#!/bin/bash
# ============================================
# Configuration Validation & Health Check
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     THREAT MODELING PLATFORM - CONFIGURATION VALIDATOR       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# ============================================
# 1. Environment Configuration Check
# ============================================
echo -e "${BLUE}[1/6] Environment Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f .env ]; then
    echo -e "${RED}✗${NC} .env file not found"
    ((ERRORS++))
    echo "  Run installer: ./install.sh or ./setup.sh"
else
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Load .env
    export $(grep -v '^#' .env | xargs)
    
    # Check required variables
    REQUIRED_VARS=("DB_ENCRYPTION_KEY" "JWT_PRIVATE_KEY" "JWT_PUBLIC_KEY" "PORT")
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}  ✗${NC} $var is not set"
            ((ERRORS++))
        else
            # Mask secret values
            if [[ $var == *"KEY"* ]] || [[ $var == *"TOKEN"* ]] || [[ $var == *"SECRET"* ]]; then
                VALUE="${!var}"
                echo -e "${GREEN}  ✓${NC} $var = ${VALUE:0:8}...${VALUE: -8} ($(echo -n ${!var} | wc -c) chars)"
            else
                echo -e "${GREEN}  ✓${NC} $var = ${!var}"
            fi
        fi
    done
    
    # Check optional features
    echo ""
    echo "Feature Flags:"
    if [ "$ENABLE_LLM" == "true" ]; then
        echo -e "${GREEN}  ✓${NC} LLM Enabled"
        if [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
            echo -e "${YELLOW}  ⚠${NC}  No LLM API keys configured"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}  ○${NC} LLM Disabled"
    fi
    
    if [ "$ENABLE_JIRA" == "true" ]; then
        echo -e "${GREEN}  ✓${NC} Jira Enabled"
        if [ -z "$JIRA_HOST" ] || [ -z "$JIRA_API_TOKEN" ]; then
            echo -e "${RED}  ✗${NC} Jira credentials missing"
            ((ERRORS++))
        fi
    else
        echo -e "${YELLOW}  ○${NC} Jira Disabled"
    fi
    
    if [ "$ENABLE_GITHUB" == "true" ]; then
        echo -e "${GREEN}  ✓${NC} GitHub Enabled"
        if [ -z "$GITHUB_TOKEN" ]; then
            echo -e "${RED}  ✗${NC} GitHub token missing"
            ((ERRORS++))
        fi
    else
        echo -e "${YELLOW}  ○${NC} GitHub Disabled"
    fi
fi

echo ""

# ============================================
# 2. Security Keys Validation
# ============================================
echo -e "${BLUE}[2/6] Security Keys Validation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check JWT keys
if [ -f .keys/private.pem ]; then
    echo -e "${GREEN}✓${NC} JWT private key file exists"
    HASH=$(sha256sum .keys/private.pem | cut -d' ' -f1 | head -c 16)
    echo "  SHA256: $HASH..."
    
    # Verify it's a valid RSA key
    if openssl rsa -in .keys/private.pem -check -noout 2>/dev/null; then
        echo -e "${GREEN}  ✓${NC} Valid RSA private key"
    else
        echo -e "${RED}  ✗${NC} Invalid RSA private key"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠${NC}  JWT private key file not found"
    ((WARNINGS++))
fi

if [ -f .keys/public.pem ]; then
    echo -e "${GREEN}✓${NC} JWT public key file exists"
    HASH=$(sha256sum .keys/public.pem | cut -d' ' -f1 | head -c 16)
    echo "  SHA256: $HASH..."
else
    echo -e "${YELLOW}⚠${NC}  JWT public key file not found"
    ((WARNINGS++))
fi

# Check DB encryption key strength
if [ ! -z "$DB_ENCRYPTION_KEY" ]; then
    KEY_LENGTH=$(echo -n "$DB_ENCRYPTION_KEY" | wc -c)
    if [ $KEY_LENGTH -ge 32 ]; then
        echo -e "${GREEN}✓${NC} DB encryption key strength: $KEY_LENGTH characters"
    else
        echo -e "${YELLOW}⚠${NC}  DB encryption key is weak: $KEY_LENGTH characters (32+ recommended)"
        ((WARNINGS++))
    fi
fi

echo ""

# ============================================
# 3. File Structure Check
# ============================================
echo -e "${BLUE}[3/6] File Structure${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

REQUIRED_FILES=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "backend/api/package.json"
    "frontend/package.json"
    "backend/api/src/index.ts"
    "backend/routes/jira.routes.ts"
    "backend/api/src/database/schema.sql"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        ((ERRORS++))
    fi
done

REQUIRED_DIRS=(
    "data/db"
    "data/backups"
    "logs"
    "infra/docker/ssl"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir/"
    else
        echo -e "${YELLOW}⚠${NC}  $dir/ (missing)"
        ((WARNINGS++))
    fi
done

echo ""

# ============================================
# 4. Docker Environment Check
# ============================================
echo -e "${BLUE}[4/6] Docker Environment${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker installed: $(docker --version)"
    
    # Check if Docker is running
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker daemon is running"
        
        # Check running containers
        RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
        TOTAL=$(docker-compose ps --services 2>/dev/null | wc -l)
        echo "  Running services: $RUNNING/$TOTAL"
    else
        echo -e "${RED}✗${NC} Docker daemon is not running"
        ((ERRORS++))
    fi
else
    echo -e "${RED}✗${NC} Docker not found"
    ((ERRORS++))
fi

if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✓${NC} Docker Compose installed: $(docker-compose --version)"
else
    echo -e "${RED}✗${NC} Docker Compose not found"
    ((ERRORS++))
fi

echo ""

# ============================================
# 5. Service Health Checks
# ============================================
echo -e "${BLUE}[5/6] Service Health Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_service() {
    local url=$1
    local name=$2
    
    if curl -f -k -s "$url" -m 5 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name ($url)"
        return 0
    else
        echo -e "${RED}✗${NC} $name ($url) - not responding"
        return 1
    fi
}

SERVICES_OK=0

if check_service "https://localhost/api/health" "API Backend"; then
    ((SERVICES_OK++))
fi

if check_service "https://localhost/analysis/health" "Analysis Service"; then
    ((SERVICES_OK++))
fi

if check_service "https://localhost/" "Frontend"; then
    ((SERVICES_OK++))
fi

if [ $SERVICES_OK -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}Note:${NC} No services are running. Start with: docker-compose up -d"
    ((WARNINGS++))
elif [ $SERVICES_OK -lt 3 ]; then
    echo ""
    echo -e "${YELLOW}Note:${NC} Some services are not running. Check logs: docker-compose logs"
    ((WARNINGS++))
fi

echo ""

# ============================================
# 6. API Configuration Validation
# ============================================
echo -e "${BLUE}[6/6] API Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Jira routes are integrated
if grep -q "jiraRoutes" backend/api/src/index.ts 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Jira routes integrated in API"
else
    echo -e "${RED}✗${NC} Jira routes NOT integrated in API"
    ((ERRORS++))
fi

# Check backend package.json dependencies
if grep -q '"express": "\^4' backend/api/package.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Express v4 configured correctly"
else
    echo -e "${YELLOW}⚠${NC}  Express version mismatch"
    ((WARNINGS++))
fi

if grep -q '"better-sqlite3"' backend/api/package.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} SQLite database driver configured"
else
    echo -e "${YELLOW}⚠${NC}  SQLite driver not found"
    ((WARNINGS++))
fi

# Check frontend API URL
if grep -q "localhost:3001" frontend/src/services/api.client.ts 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Frontend API URL points to correct port (3001)"
else
    echo -e "${YELLOW}⚠${NC}  Frontend API URL may be misconfigured"
    ((WARNINGS++))
fi

echo ""

# ============================================
# Summary
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}VALIDATION SUMMARY${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your installation is ready. Start services with:"
    echo "  docker-compose up -d"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Configuration has $WARNINGS warning(s)${NC}"
    echo ""
    echo "Your installation should work, but consider addressing warnings."
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix errors before starting services."
    echo ""
    echo "Common fixes:"
    echo "  • Missing .env:         Run ./install.sh or ./setup.sh"
    echo "  • Missing directories:  mkdir -p data/db data/backups logs"
    echo "  • Docker not running:   Start Docker Desktop"
    echo "  • Invalid keys:         Re-run installer to regenerate keys"
    exit 1
fi
