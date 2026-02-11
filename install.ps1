# ============================================
# Threat Modeling Platform - Windows Installer
# ============================================
# PowerShell Script for Windows 10/11
# ============================================

# Set error handling
$ErrorActionPreference = "Stop"

# Colors
function Write-Green { Write-Host $args -ForegroundColor Green }
function Write-Yellow { Write-Host $args -ForegroundColor Yellow }
function Write-Red { Write-Host $args -ForegroundColor Red }
function Write-Blue { Write-Host $args -ForegroundColor Blue }

# Logo
Write-Blue @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     THREAT MODELING PLATFORM - INSTALLER v1.0                ║
║                                                               ║
║     Comprehensive security threat analysis & modeling        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@

Write-Host ""

# ============================================
# Step 1: System Validation
# ============================================
Write-Blue "[1/8] System Validation"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

Write-Green "✓ Operating System: Windows"

# Check Docker
try {
    $dockerVersion = (docker --version) -replace 'Docker version ([\d.]+).*', '$1'
    Write-Green "✓ Docker installed: v$dockerVersion"
} catch {
    Write-Red "✗ Docker is not installed"
    Write-Host ""
    Write-Host "Please install Docker Desktop:"
    Write-Host "  https://docs.docker.com/desktop/windows/install/"
    exit 1
}

# Check Docker Compose
try {
    $composeVersion = (docker-compose --version) -replace 'docker-compose version ([\d.]+).*', '$1'
    Write-Green "✓ Docker Compose installed: v$composeVersion"
} catch {
    Write-Red "✗ Docker Compose is not installed"
    exit 1
}

# Check if Docker is running
try {
    docker ps > $null 2>&1
    Write-Green "✓ Docker daemon is running"
} catch {
    Write-Red "✗ Docker daemon is not running"
    Write-Host "Please start Docker Desktop"
    exit 1
}

# Check disk space
$drive = (Get-Location).Drive
$freeSpace = [math]::Round((Get-PSDrive $drive.Name).Free / 1GB, 2)
if ($freeSpace -lt 2) {
    Write-Yellow "⚠  Low disk space: ${freeSpace}GB available (2GB+ recommended)"
}

Write-Host ""

# ============================================
# Step 2: Feature Selection
# ============================================
Write-Blue "[2/8] Feature Selection"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Select which optional features to enable:"
Write-Host ""

# LLM Features
Write-Yellow "🤖 AI-Powered Threat Analysis"
Write-Host "   Uses OpenAI GPT-4 or Anthropic Claude for intelligent threat detection"
Write-Host "   Requires: API key from OpenAI (`$20-100/month) or Anthropic"
$ENABLE_LLM = Read-Host "   Enable LLM features? [y/N]"
Write-Host ""

# Jira Integration
Write-Yellow "🎫 Jira/Atlassian Integration"
Write-Host "   Sync threats to Jira issues, bidirectional status updates"
Write-Host "   Requires: Jira Cloud account + API token (free for personal use)"
$ENABLE_JIRA = Read-Host "   Enable Jira integration? [y/N]"
Write-Host ""

# GitHub Integration
Write-Yellow "🐙 GitHub Integration"
Write-Host "   Monitor repositories for security issues, analyze IaC"
Write-Host "   Requires: GitHub personal access token (free)"
$ENABLE_GITHUB = Read-Host "   Enable GitHub integration? [y/N]"
Write-Host ""

# ============================================
# Step 3: Configuration Generation
# ============================================
Write-Blue "[3/8] Configuration Generation"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup existing .env
if (Test-Path .env) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Write-Yellow "⚠  .env file exists. Creating backup..."
    Copy-Item .env ".env.backup.$timestamp"
}

Copy-Item .env.example .env
Write-Green "✓ Created .env configuration file"

# Generate database encryption key
Write-Host "Generating database encryption key..."
$DB_KEY = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$DB_HASH = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($DB_KEY))) -Algorithm SHA256).Hash.Substring(0, 12)
Write-Green "✓ DB Key: $($DB_KEY.Substring(0, 12))...$($DB_KEY.Substring($DB_KEY.Length - 12)) (SHA256: $DB_HASH...)"

# Generate RSA keypair for JWT
Write-Host "Generating RSA keypair for JWT authentication..."
New-Item -ItemType Directory -Force -Path .keys | Out-Null

# Generate private key
$rsaArgs = @("genrsa", "-out", ".keys/private.pem", "2048")
$process = Start-Process -FilePath "openssl" -ArgumentList $rsaArgs -NoNewWindow -Wait -PassThru -RedirectStandardError "NUL"

# Generate public key
$rsaArgs = @("rsa", "-in", ".keys/private.pem", "-pubout", "-out", ".keys/public.pem")
$process = Start-Process -FilePath "openssl" -ArgumentList $rsaArgs -NoNewWindow -Wait -PassThru -RedirectStandardError "NUL"

# Base64 encode keys
$JWT_PRIVATE_B64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes(".keys/private.pem"))
$JWT_PUBLIC_B64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes(".keys/public.pem"))

$JWT_PRIVATE_HASH = (Get-FileHash -Path ".keys/private.pem" -Algorithm SHA256).Hash.Substring(0, 16)
$JWT_PUBLIC_HASH = (Get-FileHash -Path ".keys/public.pem" -Algorithm SHA256).Hash.Substring(0, 16)
Write-Green "✓ JWT Private Key (SHA256: $JWT_PRIVATE_HASH...)"
Write-Green "✓ JWT Public Key  (SHA256: $JWT_PUBLIC_HASH...)"

# Update .env file
(Get-Content .env) | ForEach-Object {
    $_ -replace 'DB_ENCRYPTION_KEY=change-this-in-production-use-openssl-rand-hex-32', "DB_ENCRYPTION_KEY=$DB_KEY" `
       -replace 'JWT_PRIVATE_KEY=', "JWT_PRIVATE_KEY=$JWT_PRIVATE_B64" `
       -replace 'JWT_PUBLIC_KEY=', "JWT_PUBLIC_KEY=$JWT_PUBLIC_B64"
} | Set-Content .env

Write-Host ""

# ============================================
# Step 4: Optional Feature Configuration
# ============================================
Write-Blue "[4/8] Feature Configuration"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configure LLM
if ($ENABLE_LLM -match '^[Yy]$') {
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'ENABLE_LLM=true', 'ENABLE_LLM=true' `
           -replace 'REACT_APP_ENABLE_LLM=true', 'REACT_APP_ENABLE_LLM=true'
    } | Set-Content .env
    
    Write-Green "✓ LLM features enabled"
    Write-Host ""
    Write-Host "Select LLM provider:"
    Write-Host "  1) OpenAI (GPT-4)"
    Write-Host "  2) Anthropic (Claude)"
    $LLM_CHOICE = Read-Host "Provider [1]"
    if ([string]::IsNullOrEmpty($LLM_CHOICE)) { $LLM_CHOICE = "1" }
    
    if ($LLM_CHOICE -eq "2") {
        (Get-Content .env) | ForEach-Object {
            $_ -replace 'LLM_PROVIDER=openai', 'LLM_PROVIDER=anthropic' `
               -replace 'LLM_MODEL=gpt-4', 'LLM_MODEL=claude-3-opus-20240229'
        } | Set-Content .env
        
        Write-Host ""
        $ANTHROPIC_KEY = Read-Host "Enter Anthropic API key"
        (Get-Content .env) | ForEach-Object {
            $_ -replace 'ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here', "ANTHROPIC_API_KEY=$ANTHROPIC_KEY"
        } | Set-Content .env
        Write-Green "✓ Anthropic configured"
    } else {
        Write-Host ""
        $OPENAI_KEY = Read-Host "Enter OpenAI API key"
        (Get-Content .env) | ForEach-Object {
            $_ -replace 'OPENAI_API_KEY=sk-your-openai-api-key-here', "OPENAI_API_KEY=$OPENAI_KEY"
        } | Set-Content .env
        Write-Green "✓ OpenAI configured"
    }
} else {
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'ENABLE_LLM=true', 'ENABLE_LLM=false' `
           -replace 'REACT_APP_ENABLE_LLM=true', 'REACT_APP_ENABLE_LLM=false'
    } | Set-Content .env
    Write-Yellow "○ LLM features disabled"
}
Write-Host ""

# Configure Jira
if ($ENABLE_JIRA -match '^[Yy]$') {
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'ENABLE_JIRA=false', 'ENABLE_JIRA=true' `
           -replace 'REACT_APP_ENABLE_JIRA=false', 'REACT_APP_ENABLE_JIRA=true'
    } | Set-Content .env
    
    Write-Green "✓ Jira integration enabled"
    Write-Host ""
    $JIRA_HOST = Read-Host "Jira host (e.g., company.atlassian.net)"
    $JIRA_EMAIL = Read-Host "Jira email"
    $JIRA_TOKEN = Read-Host "Jira API token"
    $JIRA_PROJECT = Read-Host "Jira project key [SEC]"
    if ([string]::IsNullOrEmpty($JIRA_PROJECT)) { $JIRA_PROJECT = "SEC" }
    
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'JIRA_HOST=your-company.atlassian.net', "JIRA_HOST=$JIRA_HOST" `
           -replace 'JIRA_EMAIL=your-email@company.com', "JIRA_EMAIL=$JIRA_EMAIL" `
           -replace 'JIRA_API_TOKEN=your-jira-api-token-here', "JIRA_API_TOKEN=$JIRA_TOKEN" `
           -replace 'JIRA_PROJECT_KEY=SEC', "JIRA_PROJECT_KEY=$JIRA_PROJECT"
    } | Set-Content .env
    
    Write-Green "✓ Jira configured"
} else {
    Write-Yellow "○ Jira integration disabled"
}
Write-Host ""

# Configure GitHub
if ($ENABLE_GITHUB -match '^[Yy]$') {
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'ENABLE_GITHUB=false', 'ENABLE_GITHUB=true'
    } | Set-Content .env
    
    Write-Green "✓ GitHub integration enabled"
    Write-Host ""
    $GITHUB_TOKEN = Read-Host "GitHub personal access token"
    
    (Get-Content .env) | ForEach-Object {
        $_ -replace 'GITHUB_TOKEN=ghp_your_github_personal_access_token', "GITHUB_TOKEN=$GITHUB_TOKEN"
    } | Set-Content .env
    
    Write-Green "✓ GitHub configured"
} else {
    Write-Yellow "○ GitHub integration disabled"
}
Write-Host ""

# ============================================
# Step 5: Directory Setup
# ============================================
Write-Blue "[5/8] Directory Setup"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

New-Item -ItemType Directory -Force -Path "data/db", "data/backups", "logs" | Out-Null

Write-Green "✓ Created data/db (database storage)"
Write-Green "✓ Created data/backups (automatic backups)"
Write-Green "✓ Created logs (application logs)"
Write-Host ""

# ============================================
# Step 6: SSL Certificate Generation
# ============================================
Write-Blue "[6/8] SSL Certificate Generation"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if (-not (Test-Path "infra/docker/ssl/cert.pem")) {
    Push-Location infra/docker
    & bash generate-ssl.sh
    Pop-Location
    Write-Green "✓ SSL certificates generated (self-signed for development)"
} else {
    Write-Green "✓ SSL certificates already exist"
}
Write-Host ""

# ============================================
# Step 7: Build & Deploy
# ============================================
Write-Blue "[7/8] Build & Deploy"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

Write-Host "Building Docker images (this may take 5-10 minutes)..."
docker-compose build --progress=plain

Write-Host ""
Write-Host "Starting services..."
docker-compose up -d

Write-Host ""
Write-Host "Waiting for services to initialize..."
Start-Sleep -Seconds 15

# ============================================
# Step 8: Health Verification
# ============================================
Write-Host ""
Write-Blue "[8/8] Health Verification"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

function Test-ServiceHealth {
    param($url, $name)
    try {
        $response = Invoke-WebRequest -Uri $url -SkipCertificateCheck -TimeoutSec 5 -ErrorAction Stop
        Write-Green "✓ $name"
        return $true
    } catch {
        Write-Red "✗ $name (not responding)"
        return $false
    }
}

$healthPass = 0
$healthTotal = 0

$healthTotal++
if (Test-ServiceHealth "https://localhost/api/health" "API Backend") { $healthPass++ }

$healthTotal++
if (Test-ServiceHealth "https://localhost/analysis/health" "Analysis Service") { $healthPass++ }

$healthTotal++
if (Test-ServiceHealth "https://localhost/" "Frontend") { $healthPass++ }

Write-Host ""
Write-Host "Health Status: $healthPass/$healthTotal services healthy"

if ($healthPass -eq $healthTotal) {
    Write-Green "✓ All services are healthy!"
} else {
    Write-Yellow "⚠ Some services failed health checks"
    Write-Host "  This may be normal if services need more time to start."
    Write-Host "  Check logs with: docker-compose logs -f"
}

# ============================================
# Installation Complete
# ============================================
Write-Host ""
Write-Green @"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                  ✓ INSTALLATION COMPLETE!                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"@

Write-Host ""
Write-Host "Application URLs:"
Write-Blue "  → Frontend:  https://localhost"
Write-Blue "  → API Docs:  https://localhost/api-docs"
Write-Blue "  → API Health: https://localhost/api/health"
Write-Host ""

Write-Host "Enabled Features:"
if ($ENABLE_LLM -match '^[Yy]$') {
    Write-Green "  ✓ AI-Powered Threat Analysis"
}
if ($ENABLE_JIRA -match '^[Yy]$') {
    Write-Green "  ✓ Jira Integration"
}
if ($ENABLE_GITHUB -match '^[Yy]$') {
    Write-Green "  ✓ GitHub Integration"
}
Write-Host ""

Write-Host "Useful Commands:"
Write-Host "  docker-compose ps              # View service status"
Write-Host "  docker-compose logs -f         # View logs"
Write-Host "  docker-compose logs -f api     # View API logs only"
Write-Host "  docker-compose restart         # Restart all services"
Write-Host "  docker-compose down            # Stop all services"
Write-Host "  docker-compose up -d           # Start all services"
Write-Host ""

Write-Host "Security Keys (SAVE THESE):"
Write-Host "  DB Encryption: $DB_HASH... (in .env)"
Write-Host "  JWT Private:   $JWT_PRIVATE_HASH... (in .keys/private.pem)"
Write-Host "  JWT Public:    $JWT_PUBLIC_HASH... (in .keys/public.pem)"
Write-Host ""

Write-Yellow "⚠  Note: Browser may warn about self-signed certificate."
Write-Host "   This is normal for development. Click 'Advanced' and proceed."
Write-Host ""
Write-Green "Happy threat modeling! 🔒"
