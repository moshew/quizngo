#!/bin/bash

# Kahoot Quiz Server (Python) Installation Script

echo "🐍 Kahoot Quiz Server (Python) Installer"
echo "========================================="

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

# Create data directories
echo ""
echo "📁 Creating data directories..."
mkdir -p data
mkdir -p logs
echo "   ✅ Directories created"

# Test installation
echo ""
echo "🧪 Testing installation..."
python3 -c "import flask, flask_cors; print('✅ All packages imported successfully')"

# Set permissions
echo ""
echo "🔐 Setting permissions..."
chmod +x *.sh
chmod -R 755 data logs
echo "   ✅ Permissions set"

echo ""
echo "🎉 Installation completed!"
echo ""
echo "🚀 To start the server:"
echo "   ./start_python.sh"
echo "   or"
echo "   source venv/bin/activate && python app.py"
echo ""
echo "🌐 Server will be available at:"
echo "   http://localhost:5000"
echo ""
echo "📋 To test the API:"
echo "   curl http://localhost:5000/?status"
echo ""
echo "💡 Don't forget to update your Add-in URL to:"
echo "   const API_BASE = 'http://localhost:5000/';"
echo ""
echo "✨ Happy testing!"

