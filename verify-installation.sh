#!/bin/bash
# ============================================
# Threat Modeling Platform - Verification Test Suite
# ============================================
# Comprehensive testing after installation
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     THREAT MODELING PLATFORM - VERIFICATION SUITE            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Helper functions
test_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    if [ ! -z "$2" ]; then
        echo -e "    ${RED}↳${NC} $2"
    fi
    ((FAILED++))
}

test_skip() {
    echo -e "${YELLOW}○ SKIP${NC} $1 - $2"
    ((SKIPPED++))
}

# ============================================
# Test 1: Prerequisites
# ============================================
echo -e "${CYAN}[Test Suite 1: Prerequisites]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1.1 Docker running
if docker ps &> /dev/null; then
    test_pass "Docker daemon is running"
else
    test_fail "Docker daemon is not running" "Start Docker Desktop"
fi

# 1.2 Docker Compose
if command -v docker-compose &> /dev/null; then
    test_pass "Docker Compose available"
else
    test_fail "Docker Compose not found"
fi

# 1.3 .env file exists
if [ -f .env ]; then
    test_pass ".env configuration file exists"
    export $(grep -v '^#' .env | xargs 2>/dev/null || true)
else
    test_fail ".env file not found" "Run ./install.sh first"
fi

echo ""

# ============================================
# Test 2: Configuration Integrity
# ============================================
echo -e "${CYAN}[Test Suite 2: Configuration Integrity]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 2.1 Database encryption key
if [ ! -z "$DB_ENCRYPTION_KEY" ] && [ ${#DB_ENCRYPTION_KEY} -ge 32 ]; then
    test_pass "Database encryption key is set (${#DB_ENCRYPTION_KEY} chars)"
else
    test_fail "Database encryption key invalid or missing"
fi

# 2.2 JWT keys
if [ ! -z "$JWT_PRIVATE_KEY" ] && [ ! -z "$JWT_PUBLIC_KEY" ]; then
    test_pass "JWT keys are configured"
    
    # Verify they're base64 encoded RSA keys
    if [ -f .keys/private.pem ] && openssl rsa -in .keys/private.pem -check -noout 2>/dev/null; then
        test_pass "JWT private key is valid RSA key"
    else
        test_fail "JWT private key validation failed"
    fi
else
    test_fail "JWT keys not configured"
fi

# 2.3 Port configuration
if [ "$PORT" == "3001" ]; then
    test_pass "API port configured correctly (3001)"
else
    test_fail "API port misconfigured (expected 3001, got $PORT)"
fi

echo ""

# ============================================
# Test 3: File Structure
# ============================================
echo -e "${CYAN}[Test Suite 3: File Structure]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 3.1 Critical files
CRITICAL_FILES=(
    "docker-compose.yml:Docker composition"
    "backend/Dockerfile:Backend Dockerfile"
    "backend/api/src/index.ts:API entry point"
    "backend/routes/jira.routes.ts:Jira routes"
    "backend/api/src/database/schema.sql:Database schema"
    "frontend/Dockerfile:Frontend Dockerfile"
)

for item in "${CRITICAL_FILES[@]}"; do
    file="${item%%:*}"
    desc="${item##*:}"
    if [ -f "$file" ]; then
        test_pass "$desc exists"
    else
        test_fail "$desc missing ($file)"
    fi
done

# 3.2 Data directories
if [ -d "data/db" ] && [ -d "data/backups" ]; then
    test_pass "Data directories exist"
else
    test_fail "Data directories missing" "Run mkdir -p data/db data/backups"
fi

echo ""

# ============================================
# Test 4: Code Integration
# ============================================
echo -e "${CYAN}[Test Suite 4: Code Integration]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 4.1 Jira routes imported
if grep -q "import jiraRoutes" backend/api/src/index.ts 2>/dev/null; then
    test_pass "Jira routes imported in main API"
else
    test_fail "Jira routes NOT imported in backend/api/src/index.ts"
fi

# 4.2 Jira routes registered
if grep -q "app.use('/api/jira', jiraRoutes)" backend/api/src/index.ts 2>/dev/null; then
    test_pass "Jira routes registered with Express app"
else
    test_fail "Jira routes NOT registered in Express app"
fi

# 4.3 Correct dependencies
if grep -q '"express": "\^4' backend/api/package.json 2>/dev/null; then
    test_pass "Express v4.x configured"
else
    test_fail "Express version incorrect (should be ^4.18.2)"
fi

if grep -q '"better-sqlite3"' backend/api/package.json 2>/dev/null; then
    test_pass "SQLite database driver configured"
else
    test_fail "better-sqlite3 not found in package.json"
fi

# 4.4 Frontend API URL
if grep -q "localhost:3001" frontend/src/services/api.client.ts 2>/dev/null; then
    test_pass "Frontend points to correct API port (3001)"
else
    test_fail "Frontend API URL misconfigured"
fi

# 4.5 Dockerfile TypeScript build
if grep -q "npm run build" backend/Dockerfile 2>/dev/null; then
    test_pass "TypeScript build enabled in Dockerfile"
else
    test_fail "TypeScript build commented out in Dockerfile"
fi

# 4.6 Dockerfile CMD correct
if grep -q 'CMD \["node", "api/dist/index.js"\]' backend/Dockerfile 2>/dev/null; then
    test_pass "Dockerfile runs compiled TypeScript"
else
    test_fail "Dockerfile CMD incorrect (should run api/dist/index.js)"
fi

echo ""

# ============================================
# Test 5: Docker Services
# ============================================
echo -e "${CYAN}[Test Suite 5: Docker Services]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if services are running
RUNNING_SERVICES=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
TOTAL_SERVICES=$(docker-compose config --services 2>/dev/null | wc -l)

if [ $RUNNING_SERVICES -gt 0 ]; then
    test_pass "Docker services running ($RUNNING_SERVICES/$TOTAL_SERVICES)"
    
    # Check individual services
    SERVICES=("api" "analysis" "frontend" "nginx")
    for service in "${SERVICES[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            test_pass "$service container is running"
        else
            test_skip "$service container" "not running"
        fi
    done
else
    test_skip "Docker services" "No services running (start with: docker-compose up -d)"
fi

echo ""

# ============================================
# Test 6: Health Endpoints
# ============================================
echo -e "${CYAN}[Test Suite 6: Health Endpoints]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_endpoint() {
    local url=$1
    local name=$2
    local timeout=${3:-5}
    
    if curl -f -k -s "$url" -m $timeout > /dev/null 2>&1; then
        test_pass "$name responds ($url)"
        return 0
    else
        test_fail "$name not responding ($url)"
        return 1
    fi
}

if [ $RUNNING_SERVICES -gt 0 ]; then
    check_endpoint "https://localhost/api/health" "API health endpoint"
    check_endpoint "https://localhost/analysis/health" "Analysis health endpoint" 
    check_endpoint "https://localhost/" "Frontend"
    
    # Check API endpoints
    check_endpoint "https://localhost/api-docs" "API documentation"
else
    test_skip "Health endpoints" "Services not running"
fi

echo ""

# ============================================
# Test 7: API Functionality
# ============================================
echo -e "${CYAN}[Test Suite 7: API Functionality]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $RUNNING_SERVICES -gt 0 ]; then
    # Test Jira endpoints exist
    API_RESPONSE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/jira/status 2>/dev/null)
    
    if [ "$API_RESPONSE" == "200" ] || [ "$API_RESPONSE" == "401" ] || [ "$API_RESPONSE" == "500" ]; then
        test_pass "Jira API endpoint exists (/api/jira/status)"
    elif [ "$API_RESPONSE" == "404" ]; then
        test_fail "Jira API endpoint not found (404)" "Routes may not be integrated"
    else
        test_skip "Jira API endpoint" "Unexpected response: $API_RESPONSE"
    fi
    
    # Test health returns valid JSON
    HEALTH_JSON=$(curl -k -s https://localhost/api/health 2>/dev/null)
    if echo "$HEALTH_JSON" | jq . > /dev/null 2>&1; then
        test_pass "API returns valid JSON"
    else
        test_fail "API response is not valid JSON"
    fi
else
    test_skip "API functionality" "Services not running"
fi

echo ""

# ============================================
# Test 8: Database
# ============================================
echo -e "${CYAN}[Test Suite 8: Database]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if database file exists
DB_PATH=${DB_PATH:-"./data/threat-models.db"}
if [ -f "$DB_PATH" ]; then
    test_pass "Database file exists ($DB_PATH)"
    
    # Check file permissions
    PERMS=$(stat -c %a "$DB_PATH" 2>/dev/null || stat -f %A "$DB_PATH" 2>/dev/null)
    if [ "$PERMS" == "600" ]; then
        test_pass "Database permissions are secure (600)"
    else
        test_fail "Database permissions insecure ($PERMS, should be 600)"
    fi
    
    # Check if schema is applied (if sqlite3 is available)
    if command -v sqlite3 &> /dev/null; then
        TABLES=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
        if [ "$TABLES" -gt 0 ]; then
            test_pass "Database schema applied ($TABLES tables)"
        else
            test_fail "Database schema not applied (0 tables)"
        fi
    else
        test_skip "Database schema check" "sqlite3 not available"
    fi
else
    test_skip "Database file" "Not created yet (will be created on first run)"
fi

echo ""

# ============================================
# Test 9: Feature Configuration
# ============================================
echo -e "${CYAN}[Test Suite 9: Feature Configuration]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check LLM configuration
if [ "$ENABLE_LLM" == "true" ]; then
    test_pass "LLM features enabled"
    
    if [ ! -z "$OPENAI_API_KEY" ] || [ ! -z "$ANTHROPIC_API_KEY" ]; then
        test_pass "LLM API keys configured"
    else
        test_fail "LLM enabled but no API keys set"
    fi
else
    test_pass "LLM features disabled (as configured)"
fi

# Check Jira configuration
if [ "$ENABLE_JIRA" == "true" ]; then
    test_pass "Jira integration enabled"
    
    if [ ! -z "$JIRA_HOST" ] && [ ! -z "$JIRA_API_TOKEN" ]; then
        test_pass "Jira credentials configured"
    else
        test_fail "Jira enabled but credentials missing"
    fi
else
    test_pass "Jira integration disabled (as configured)"
fi

echo ""

# ============================================
# Test 10: Security
# ============================================
echo -e "${CYAN}[Test Suite 10: Security]${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check .env is not committed (if in git repo)
if [ -d .git ]; then
    if git check-ignore .env &> /dev/null; then
        test_pass ".env is gitignored"
    else
        test_fail ".env is NOT gitignored" "Risk of leaking secrets"
    fi
fi

# Check key files permissions
if [ -f .keys/private.pem ]; then
    PERMS=$(stat -c %a .keys/private.pem 2>/dev/null || stat -f %A .keys/private.pem 2>/dev/null)
    if [ "$PERMS" == "600" ]; then
        test_pass "Private key permissions secure (600)"
    else
        test_fail "Private key permissions insecure ($PERMS)" "Run: chmod 600 .keys/private.pem"
    fi
fi

# Check for default/weak secrets
if grep -q "change-this-in-production" .env 2>/dev/null; then
    test_fail "Default secrets detected in .env" "Re-run installer to generate secure keys"
else
    test_pass "No default secrets in configuration"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL=$((PASSED + FAILED + SKIPPED))
PASS_RATE=0
if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$((PASSED * 100 / TOTAL))
fi

echo -e "${GREEN}Passed:${NC}  $PASSED"
echo -e "${RED}Failed:${NC}  $FAILED"
echo -e "${YELLOW}Skipped:${NC} $SKIPPED"
echo -e "Total:   $TOTAL"
echo ""
echo -e "Pass Rate: $PASS_RATE%"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Your installation is verified and ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Access frontend: https://localhost"
    echo "  2. View API docs: https://localhost/api-docs"
    echo "  3. Check logs: docker-compose logs -f"
    exit 0
elif [ $FAILED -le 3 ] && [ $PASS_RATE -ge 80 ]; then
    echo ""
    echo -e "${YELLOW}⚠ Tests completed with minor issues${NC}"
    echo ""
    echo "Your installation should work with some limitations."
    echo "Review failed tests above and fix if needed."
    exit 0
else
    echo ""
    echo -e "${RED}✗ Multiple tests failed${NC}"
    echo ""
    echo "Please review and address the failures above before using the platform."
    echo ""
    echo "Common solutions:"
    echo "  • Run installer: ./install.sh"
    echo "  • Fix configuration: ./validate-config.sh"
    echo "  • Rebuild services: docker-compose build"
    echo "  • Check logs: docker-compose logs"
    exit 1
fi
