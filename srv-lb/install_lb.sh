#!/bin/bash

# Kahoot Load Balancer Installation Script

echo "🎯 Kahoot Load Balancer Installer"
echo "=================================="

# Check Python version
echo "🔍 Checking Python installation..."
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "   ✅ Python 3 found: $PYTHON_VERSION"
else
    echo "   ❌ Python 3 not found!"
    echo "      Please install Python 3.7+ before continuing"
    echo "      Ubuntu/Debian: sudo apt-get install python3 python3-pip"
    echo "      CentOS/RHEL: sudo yum install python3 python3-pip"
    exit 1
fi

# Check pip
if command -v pip3 >/dev/null 2>&1; then
    echo "   ✅ pip3 found"
else
    echo "   ❌ pip3 not found!"
    echo "      Install with: sudo apt-get install python3-pip"
    exit 1
fi

# Create virtual environment
echo ""
echo "🔧 Setting up virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "   ✅ Virtual environment created"
else
    echo "   ✅ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate
echo "   ✅ Virtual environment activated"

# Install requirements
echo ""
echo "📦 Installing Python packages..."
pip install -r requirements.txt
echo "   ✅ Packages installed"

# Test installation
echo ""
echo "🧪 Testing installation..."
python3 -c "import flask, flask_cors, requests; print('✅ All packages imported successfully')"

# Set permissions
echo ""
echo "🔐 Setting permissions..."
chmod +x *.sh
echo "   ✅ Permissions set"

echo ""
echo "🎉 Installation completed!"
echo ""
echo "🚀 To start the Load Balancer:"
echo "   ./start_lb.sh"
echo "   or"
echo "   source venv/bin/activate && python server.py"
echo ""
echo "🌐 Load Balancer will be available at:"
echo "   http://localhost:5000"
echo ""
echo "📋 To test the Load Balancer:"
echo "   curl http://localhost:5000/health"
echo ""
echo "💡 Game servers should register with:"
echo "   --lb-url http://localhost:5000"
echo ""
echo "🎮 Clients should resolve PINs via:"
echo "   http://localhost:5000/resolve/{gamePin}"
echo ""
echo "✨ Happy load balancing!"
