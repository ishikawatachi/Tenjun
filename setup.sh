#!/bin/bash
# Quick setup script for Threat Model Platform

set -e

echo "🚀 Threat Model Platform - Quick Setup"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/db data/backups
chmod 700 data/db data/backups
echo "✅ Data directories created"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    
    # Generate secure keys
    echo "🔐 Generating secure keys..."
    DB_KEY=$(openssl rand -hex 32)
    
    # Generate RSA keypair for JWT
    echo "🔑 Generating RSA keypair for JWT..."
    mkdir -p .keys
    openssl genrsa -out .keys/private.pem 2048 2>/dev/null
    openssl rsa -in .keys/private.pem -pubout -out .keys/public.pem 2>/dev/null
    
    # Base64 encode the keys for environment variables
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        JWT_PRIVATE_B64=$(base64 < .keys/private.pem | tr -d '\n')
        JWT_PUBLIC_B64=$(base64 < .keys/public.pem | tr -d '\n')
    else
        # Linux
        JWT_PRIVATE_B64=$(base64 -w 0 < .keys/private.pem)
        JWT_PUBLIC_B64=$(base64 -w 0 < .keys/public.pem)
    fi
    
    # Update .env with generated keys
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DB_ENCRYPTION_KEY=change-this-in-production-use-openssl-rand-hex-32|DB_ENCRYPTION_KEY=$DB_KEY|" .env
        sed -i '' "s|JWT_PRIVATE_KEY=|JWT_PRIVATE_KEY=$JWT_PRIVATE_B64|" .env
        sed -i '' "s|JWT_PUBLIC_KEY=|JWT_PUBLIC_KEY=$JWT_PUBLIC_B64|" .env
    else
        # Linux
        sed -i "s|DB_ENCRYPTION_KEY=change-this-in-production-use-openssl-rand-hex-32|DB_ENCRYPTION_KEY=$DB_KEY|" .env
        sed -i "s|JWT_PRIVATE_KEY=|JWT_PRIVATE_KEY=$JWT_PRIVATE_B64|" .env
        sed -i "s|JWT_PUBLIC_KEY=|JWT_PUBLIC_KEY=$JWT_PUBLIC_B64|" .env
    fi
    
    echo "✅ .env file created with secure keys"
    echo "✅ RSA keypair generated and saved to .keys/"
    echo ""
    echo "⚠️  OPTIONAL FEATURES:"
    echo ""
    
    # Ask about LLM features
    echo "🤖 Enable LLM-powered threat analysis? (requires API keys)"
    read -p "   Enable LLM features? [y/N]: " enable_llm
    if [[ "$enable_llm" =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/ENABLE_LLM=true/ENABLE_LLM=true/" .env
        else
            sed -i "s/ENABLE_LLM=true/ENABLE_LLM=true/" .env
        fi
        echo ""
        echo "   Please add your API keys to .env:"
        echo "   - OPENAI_API_KEY=sk-..."
        echo "   - ANTHROPIC_API_KEY=sk-ant-..."
    else
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/ENABLE_LLM=true/ENABLE_LLM=false/" .env
        else
            sed -i "s/ENABLE_LLM=true/ENABLE_LLM=false/" .env
        fi
        echo "   LLM features disabled"
    fi
    echo ""
    
    # Ask about Jira integration
    echo "🎫 Enable Jira/Atlassian integration?"
    read -p "   Enable Jira? [y/N]: " enable_jira
    if [[ "$enable_jira" =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/ENABLE_JIRA=false/ENABLE_JIRA=true/" .env
        else
            sed -i "s/ENABLE_JIRA=false/ENABLE_JIRA=true/" .env
        fi
        echo ""
        echo "   Please configure Jira settings in .env:"
        echo "   - JIRA_HOST=your-company.atlassian.net"
        echo "   - JIRA_EMAIL=your-email@company.com"
        echo "   - JIRA_API_TOKEN=..."
        echo "   - JIRA_PROJECT_KEY=SEC"
    else
        echo "   Jira integration disabled"
    fi
    echo ""
    
    if [[ "$enable_llm" =~ ^[Yy]$ ]] || [[ "$enable_jira" =~ ^[Yy]$ ]]; then
        echo "⏸️  Please edit .env with your configuration now."
        read -p "Press Enter after you've configured .env..."
    fi
else
    echo "✅ .env file already exists"
fi
echo ""

# Generate SSL certificates if they don't exist
if [ ! -f infra/docker/ssl/cert.pem ]; then
    echo "🔒 Generating SSL certificates..."
    cd infra/docker
    chmod +x generate-ssl.sh
    ./generate-ssl.sh
    cd ../..
    echo "✅ SSL certificates generated"
else
    echo "✅ SSL certificates already exist"
fi
echo ""

# Make scripts executable
echo "🔧 Setting script permissions..."
chmod +x infra/docker/*.sh
echo "✅ Scripts are executable"
echo ""

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build
echo "✅ Images built successfully"
echo ""

echo "🚀 Starting services..."
docker-compose up -d
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps
echo ""

# Test health endpoints
echo "🏥 Testing health endpoints..."
echo ""

echo -n "API Service: "
if curl -f -k https://localhost/api/health &>/dev/null; then
    echo "✅ Healthy"
else
    echo "⚠️  Not responding (may need more time to start)"
fi

echo -n "Analysis Service: "
if curl -f -k https://localhost/analysis/health &>/dev/null; then
    echo "✅ Healthy"
else
    echo "⚠️  Not responding (may need more time to start)"
fi

echo -n "Frontend: "
if curl -f -k https://localhost/ &>/dev/null; then
    echo "✅ Healthy"
else
    echo "⚠️  Not responding (may need more time to start)"
fi

echo ""
echo "======================================"
echo "🎉 Setup Complete!"
echo "======================================"
echo ""
echo "Access your application at:"
echo "  • Frontend:  https://localhost"
echo "  • API:       https://localhost/api"
echo "  • Analysis:  https://localhost/analysis"
echo ""
echo "Useful commands:"
echo "  • View logs:        docker-compose logs -f"
echo "  • Stop services:    docker-compose down"
echo "  • Restart:          docker-compose restart"
echo "  • Service status:   docker-compose ps"
echo ""
echo "⚠️  Note: Browser may warn about self-signed certificate"
echo "    This is normal for development. Click 'Advanced' and proceed."
echo ""
