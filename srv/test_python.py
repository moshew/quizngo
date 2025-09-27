#!/usr/bin/env python3
"""
Test script for Kahoot Quiz Server (Python)
Use this to verify your installation is working correctly
"""

import sys
import os
import json
import requests
import time
from pathlib import Path

def test_imports():
    """Test if all required packages are available"""
    print("1. Package Import Test")
    print("=" * 30)
    
    try:
        import flask
        print(f"   ✅ Flask: {flask.__version__}")
    except ImportError:
        print("   ❌ Flask: NOT FOUND")
        return False
    
    try:
        import flask_cors
        print(f"   ✅ Flask-CORS: {flask_cors.__version__}")
    except ImportError:
        print("   ❌ Flask-CORS: NOT FOUND")
        return False
    
    print("   ✅ All packages available")
    return True

def test_directories():
    """Test if required directories exist"""
    print("\n2. Directory Structure Test")
    print("=" * 30)
    
    base_dir = Path(__file__).parent
    required_dirs = ['data', 'logs']
    
    all_exist = True
    for dir_name in required_dirs:
        dir_path = base_dir / dir_name
        if dir_path.exists():
            print(f"   ✅ {dir_name}/: exists")
        else:
            print(f"   ❌ {dir_name}/: NOT FOUND")
            all_exist = False
    
    return all_exist

def test_files():
    """Test if required files exist"""
    print("\n3. Required Files Test")
    print("=" * 30)
    
    base_dir = Path(__file__).parent
    required_files = [
        'app.py',
        'config.py', 
        'requirements.txt'
    ]
    
    all_exist = True
    for file_name in required_files:
        file_path = base_dir / file_name
        if file_path.exists():
            size = file_path.stat().st_size
            print(f"   ✅ {file_name}: {size} bytes")
        else:
            print(f"   ❌ {file_name}: NOT FOUND")
            all_exist = False
    
    return all_exist

def test_server_local():
    """Test if server is running locally"""
    print("\n4. Local Server Test")
    print("=" * 30)
    
    base_url = "http://localhost:5000"
    
    try:
        # Test basic connection
        response = requests.get(base_url, timeout=5)
        if response.status_code == 200:
            print("   ✅ Server is responding")
        else:
            print(f"   ❌ Server returned status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to server")
        print("      Make sure the server is running: python app.py")
        return False
    except Exception as e:
        print(f"   ❌ Connection error: {e}")
        return False
    
    return True

def test_api_endpoints():
    """Test API endpoints"""
    print("\n5. API Endpoints Test")
    print("=" * 30)
    
    base_url = "http://localhost:5000"
    endpoints = [
        ('/?status', 'Status'),
        ('/?init', 'Initialize'),
        ('/?get_users', 'Get Users'),
        ('/?get_time', 'Get Time'),
        ('/?next_page', 'Next Page'),
    ]
    
    all_working = True
    
    for endpoint, name in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                print(f"   ✅ {name}: OK")
            else:
                print(f"   ❌ {name}: Status {response.status_code}")
                all_working = False
        except Exception as e:
            print(f"   ❌ {name}: Error - {e}")
            all_working = False
    
    return all_working

def test_game_flow():
    """Test complete game flow"""
    print("\n6. Game Flow Simulation")
    print("=" * 30)
    
    base_url = "http://localhost:5000"
    
    try:
        # Reset game
        print("   🔄 Resetting game...")
        response = requests.get(f"{base_url}/?reset")
        if response.status_code != 200:
            print("   ❌ Failed to reset game")
            return False
        
        # Initialize game
        print("   🚀 Initializing game...")
        response = requests.get(f"{base_url}/?init")
        if response.status_code == 200:
            data = response.json()
            users = data['data']['users']
            print(f"   ✅ Game initialized with {users} users")
        else:
            print("   ❌ Failed to initialize game")
            return False
        
        # Get users
        response = requests.get(f"{base_url}/?get_users")
        if response.status_code == 200:
            users = response.text
            print(f"   👥 Current users: {users}")
        else:
            print("   ❌ Failed to get users")
            return False
        
        # Get time
        response = requests.get(f"{base_url}/?get_time")
        if response.status_code == 200:
            time_remaining = response.text
            print(f"   ⏰ Time remaining: {time_remaining} seconds")
        else:
            print("   ❌ Failed to get time")
            return False
        
        # Next slide
        response = requests.get(f"{base_url}/?next_page")
        if response.status_code == 200:
            data = response.json()
            slide = data['slide']
            print(f"   ➡️ Moved to slide {slide}")
        else:
            print("   ❌ Failed to move to next slide")
            return False
        
        print("   ✅ All game functions working correctly")
        return True
        
    except Exception as e:
        print(f"   ❌ Game flow error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Kahoot Quiz Server (Python) Test Suite")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_directories,
        test_files,
        test_server_local,
        test_api_endpoints,
        test_game_flow
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    # Summary
    print("🏁 Test Summary")
    print("=" * 30)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✅ All tests passed! Your server is ready to use.")
        print()
        print("🔗 Quick links:")
        print("   Server: http://localhost:5000")
        print("   Status: http://localhost:5000/?status")
        print("   Init: http://localhost:5000/?init")
        print()
        print("💡 Update your Add-in URL to:")
        print("   const API_BASE = 'http://localhost:5000/';")
    else:
        print("❌ Some tests failed. Please fix the issues before using the server.")
        print()
        print("🔧 Common fixes:")
        print("   - Run: pip install -r requirements.txt")
        print("   - Create missing directories: mkdir data logs")
        print("   - Start server: python app.py")
    
    print()
    print("✨ Happy testing!")

if __name__ == "__main__":
    main()

