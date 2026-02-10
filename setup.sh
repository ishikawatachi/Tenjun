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
    JWT_KEY=$(openssl rand -hex 32)
    
    # Update .env with generated keys
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-secure-encryption-key-here-change-in-production/$DB_KEY/" .env
        sed -i '' "s/your-jwt-secret-key-change-in-production/$JWT_KEY/" .env
    else
        # Linux
        sed -i "s/your-secure-encryption-key-here-change-in-production/$DB_KEY/" .env
        sed -i "s/your-jwt-secret-key-change-in-production/$JWT_KEY/" .env
    fi
    
    echo "✅ .env file created with secure keys"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo ""
    read -p "Press Enter after you've added your API keys to .env..."
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
