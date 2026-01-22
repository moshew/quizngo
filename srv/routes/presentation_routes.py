"""
Presentation routes for Kahoot Quiz Server.
Handles save, load, and list saved presentations.
"""

import re
import json
from pathlib import Path
from flask import Blueprint, request, jsonify


def create_presentation_routes(game, data_dir):
    """
    Create presentation routes blueprint.
    
    Args:
        game: GameManager instance
        data_dir: Path to data directory
    
    Returns:
        Blueprint with presentation routes
    """
    presentation_bp = Blueprint('presentation', __name__)

    @presentation_bp.route('/save', methods=['POST'])
    def save_presentation():
        """Save presentation data by hash ID."""
        try:
            data = request.get_json()
            
            print("=" * 50)
            print("📥 SAVE REQUEST RECEIVED:")
            print("Full JSON received:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            print("=" * 50)
            
            # Check for required fields
            if not data or 'hashId' not in data or 'data' not in data:
                print("❌ ERROR: Missing hashId or data in request")
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hashId or data in request'
                }), 400
            
            hash_id = data['hashId']
            presentation_data = data['data']
            
            print(f"📋 Extracted data:")
            print(f"  Hash ID (from client): {hash_id}")
            
            # VALIDATION: Check if hash ID is valid
            if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
                print("❌ ERROR: Invalid hash ID")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID'
                }), 400
            
            # Sanitize hash ID
            hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
            
            if len(hash_id) < 8 or len(hash_id) > 20:
                print(f"❌ ERROR: Hash ID length out of range: {len(hash_id)}")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID length'
                }), 400
            
            print(f"  Hash ID (sanitized): {hash_id}")
            print(f"  Presentation data keys: {list(presentation_data.keys()) if presentation_data else 'None'}")
            if 'gameState' in presentation_data:
                print(f"  Game state keys: {list(presentation_data['gameState'].keys())}")
                if 'slideTypeData' in presentation_data['gameState']:
                    slide_type_data = presentation_data['gameState']['slideTypeData']
                    print(f"  📝 Slide type data (keyed by UUID):")
                    print(f"     Total slides with types: {len(slide_type_data)}")
                    print(f"     Slide IDs: {list(slide_type_data.keys())}")
                    print(f"     Full data: {json.dumps(slide_type_data, indent=4, ensure_ascii=False)}")
            
            # Ensure the saved files directory exists
            saved_files_dir = data_dir / 'saved_presentations'
            saved_files_dir.mkdir(exist_ok=True)
            
            # Save the data as hash_id.json
            save_file = saved_files_dir / f'{hash_id}.json'
            
            # Final safety check
            if not str(save_file.resolve()).startswith(str(saved_files_dir.resolve())):
                print(f"❌ SECURITY ERROR: Attempted path traversal!")
                print(f"   Attempted path: {save_file}")
                print(f"   Allowed directory: {saved_files_dir}")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid file path'
                }), 400
            
            # Update presentation_data with hash_id
            if isinstance(presentation_data, dict):
                presentation_data['hashId'] = hash_id
            
            with open(save_file, 'w', encoding='utf-8') as f:
                json.dump(presentation_data, f, indent=2, ensure_ascii=False)
            
            game.log(f'✅ Saved presentation data to {save_file}')
            game.log(f'   Hash ID (from client): {hash_id}')
            game.log(f'   No cache used - data saved directly to file')
            
            return jsonify({
                'status': 'success',
                'message': 'Presentation saved successfully',
                'hashId': hash_id,
                'file': str(save_file)
            })
            
        except Exception as e:
            game.log(f'❌ Error saving presentation: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Error saving presentation: {str(e)}'
            }), 500

    @presentation_bp.route('/load', methods=['POST'])
    def load_presentation():
        """Load presentation data by hash ID."""
        try:
            data = request.get_json()
            
            if not data or 'hashId' not in data:
                return jsonify({
                    'status': 'error',
                    'message': 'Missing hashId in request'
                }), 400
            
            hash_id = data['hashId']
            
            print("=" * 50)
            print("📂 LOAD REQUEST RECEIVED:")
            print(f"  Hash ID (from client): {hash_id}")
            
            # VALIDATION: Check if hash ID is valid
            if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
                print("❌ ERROR: Invalid hash ID")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID'
                }), 400
            
            # Sanitize hash ID
            hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
            
            if len(hash_id) < 8 or len(hash_id) > 20:
                print(f"❌ ERROR: Hash ID length out of range: {len(hash_id)}")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID length'
                }), 400
            
            print(f"  Hash ID (sanitized): {hash_id}")
            
            # Look for the saved file by Hash ID
            saved_files_dir = data_dir / 'saved_presentations'
            save_file = saved_files_dir / f'{hash_id}.json'
            
            # Final safety check
            if not str(save_file.resolve()).startswith(str(saved_files_dir.resolve())):
                print(f"❌ SECURITY ERROR: Attempted path traversal!")
                print(f"   Attempted path: {save_file}")
                print(f"   Allowed directory: {saved_files_dir}")
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid file path'
                }), 400
            
            if not save_file.exists():
                print(f"ℹ️ No saved file found: {save_file} (first time)")
                game.log(f'No saved data found for hash ID: {hash_id} (first time)')
                return jsonify({
                    'status': 'not_found',
                    'message': 'No saved data found for this presentation',
                    'data': None
                }), 200  # Return 200 to avoid browser console error
            
            # Load the data directly from file
            with open(save_file, 'r', encoding='utf-8') as f:
                presentation_data = json.load(f)
            
            # Log what we loaded
            if 'gameState' in presentation_data and 'slideTypeData' in presentation_data['gameState']:
                slide_type_data = presentation_data['gameState']['slideTypeData']
                print(f"  📝 Loaded slide type data (keyed by UUID):")
                print(f"     Total slides with types: {len(slide_type_data)}")
                print(f"     Slide IDs: {list(slide_type_data.keys())}")
                print(f"     Full data: {json.dumps(slide_type_data, indent=4, ensure_ascii=False)}")
            
            print("=" * 50)
            
            game.log(f'✅ Loaded presentation data from {save_file}')
            game.log(f'   Hash ID (from client): {hash_id}')
            game.log(f'   No cache used - data loaded directly from file')
            
            return jsonify({
                'status': 'success',
                'message': 'Presentation loaded successfully',
                'hashId': hash_id,
                'data': presentation_data,
                'file': str(save_file)
            })
            
        except Exception as e:
            game.log(f'❌ Error loading presentation: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Error loading presentation: {str(e)}'
            }), 500

    @presentation_bp.route('/list_saved_files', methods=['GET'])
    def list_saved_files():
        """List all saved presentation files"""
        try:
            saved_files_dir = data_dir / 'saved_presentations'
            
            # Ensure directory exists
            if not saved_files_dir.exists():
                return jsonify({
                    'status': 'info',
                    'files': [],
                    'directory': str(saved_files_dir),
                    'message': 'Directory does not exist yet'
                })
            
            # Get all JSON files
            files = list(saved_files_dir.glob('*.json'))
            
            # Get file details
            file_details = []
            for file in files:
                file_info = {
                    'name': file.name,
                    'size': file.stat().st_size,
                    'modified': file.stat().st_mtime
                }
                
                # Try to read file content for more info
                try:
                    with open(file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        if 'gameState' in data and 'slideTypeData' in data['gameState']:
                            file_info['slides'] = len(data['gameState']['slideTypeData'])
                except:
                    file_info['slides'] = 'unknown'
                
                file_details.append(file_info)
            
            return jsonify({
                'status': 'success',
                'count': len(files),
                'files': [f['name'] for f in file_details],
                'details': file_details,
                'directory': str(saved_files_dir.absolute()),
                'message': f'Found {len(files)} saved presentation(s)'
            })
            
        except Exception as e:
            game.log(f'Error listing saved files: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Error listing files: {str(e)}'
            }), 500

    return presentation_bp
