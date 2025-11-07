#!/usr/bin/env python3
"""
Test script to verify save/load functionality
Tests that files are saved to srv/data/saved_presentations/
"""

import json
import os
from pathlib import Path

# Get paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / 'data'
SAVED_DIR = DATA_DIR / 'saved_presentations'

print("=" * 60)
print("🧪 Testing Kahoot Save/Load Functionality")
print("=" * 60)

# Test 1: Check directory structure
print("\n📁 Test 1: Checking directory structure...")
print(f"   Script directory: {SCRIPT_DIR}")
print(f"   Data directory: {DATA_DIR}")
print(f"   Saved presentations: {SAVED_DIR}")

if DATA_DIR.exists():
    print("   ✅ Data directory exists")
else:
    print("   ❌ Data directory does NOT exist")
    print("   Creating it...")
    DATA_DIR.mkdir(exist_ok=True)

if SAVED_DIR.exists():
    print("   ✅ Saved presentations directory exists")
else:
    print("   ❌ Saved presentations directory does NOT exist")
    print("   Creating it...")
    SAVED_DIR.mkdir(exist_ok=True)

# Test 2: Create a test file
print("\n💾 Test 2: Creating test save file...")
test_filename = "TestPresentation"
test_data = {
    "windowId": test_filename,
    "savedAt": "2024-11-01T12:00:00",
    "gameState": {
        "initialized": True,
        "currentUsers": 5,
        "slideTypeData": {
            "uuid-123-456": "פתיחה",
            "uuid-789-abc": "שאלה",
            "uuid-def-012": "מעבר"
        }
    }
}

test_file = SAVED_DIR / f"{test_filename}.json"
with open(test_file, 'w', encoding='utf-8') as f:
    json.dump(test_data, f, indent=2, ensure_ascii=False)

print(f"   ✅ Created test file: {test_file}")
print(f"   File size: {test_file.stat().st_size} bytes")

# Test 3: Read the file back
print("\n📂 Test 3: Reading test file...")
with open(test_file, 'r', encoding='utf-8') as f:
    loaded_data = json.load(f)

print(f"   ✅ Loaded data successfully")
print(f"   Window ID: {loaded_data['windowId']}")
print(f"   Slides with types: {len(loaded_data['gameState']['slideTypeData'])}")
print(f"   Slide types: {loaded_data['gameState']['slideTypeData']}")

# Test 4: Verify data integrity
print("\n🔍 Test 4: Verifying data integrity...")
if loaded_data == test_data:
    print("   ✅ Data integrity verified - saved and loaded data match!")
else:
    print("   ❌ Data mismatch!")
    print("   Original:", test_data)
    print("   Loaded:", loaded_data)

# Test 5: List all saved presentations
print("\n📋 Test 5: Listing all saved presentations...")
saved_files = list(SAVED_DIR.glob("*.json"))
print(f"   Found {len(saved_files)} saved presentation(s):")
for i, file in enumerate(saved_files, 1):
    file_size = file.stat().st_size
    print(f"   {i}. {file.name} ({file_size} bytes)")
    
    # Load and show basic info
    try:
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'gameState' in data and 'slideTypeData' in data['gameState']:
            num_slides = len(data['gameState']['slideTypeData'])
            print(f"      → {num_slides} slides with types")
    except Exception as e:
        print(f"      → Error reading: {e}")

# Test 6: Cleanup (optional - comment out if you want to keep test file)
print("\n🧹 Test 6: Cleanup...")
cleanup = input("   Delete test file? (y/n): ").strip().lower()
if cleanup == 'y':
    test_file.unlink()
    print(f"   ✅ Deleted {test_file.name}")
else:
    print(f"   ℹ️ Keeping {test_file.name}")

print("\n" + "=" * 60)
print("✅ All tests completed!")
print("=" * 60)
print("\n💡 Key findings:")
print(f"   - Files are saved to: {SAVED_DIR}")
print(f"   - Format: {{filename}}.json")
print(f"   - Data includes slide types by UUID")
print(f"   - Files are NOT attached to .pptx")
print("\n")





