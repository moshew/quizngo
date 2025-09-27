#!/usr/bin/env python3
"""
Kahoot Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint Kahoot Add-in
Run locally for testing: python app.py
Deploy to server: see deployment instructions
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import json
import os
import time
import random
import threading
from datetime import datetime
import logging
from pathlib import Path

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'kahoot_quiz_secret_key_2024'

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins=[
    'https://localhost:3000',
    'https://localhost:3001', 
    'http://localhost:3000',
    'http://localhost:3001',
    'https://din-online.co.il',
    'https://www.din-online.co.il',
    '*'  # Remove in production for security
])

# Configure CORS
CORS(app, origins=[
    'https://localhost:3000',
    'https://localhost:3001', 
    'http://localhost:3000',
    'http://localhost:3001',
    'https://din-online.co.il',
    'https://www.din-online.co.il',
    '*'  # Remove in production for security
])

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
LOG_DIR = Path(__file__).parent / 'logs'
GAME_DATA_FILE = DATA_DIR / 'game_data.json'
LOG_FILE = LOG_DIR / 'kahoot.log'

# Game settings
DEFAULT_SLIDE_TIME = 30
MIN_USERS = 1
MAX_USERS = 100
USER_FLUCTUATION_RANGE = 3

# Timer and WebSocket settings
active_timer = None
timer_thread = None
timer_duration = 30
timer_start_time = None
connected_clients = set()

# Create directories if they don't exist
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class GameManager:
    """Game Manager Class for Kahoot Quiz Server"""
    
    def __init__(self):
        self.data_file = GAME_DATA_FILE
        self.logger = logging.getLogger(__name__)
    
    def log(self, message):
        """Write to log file"""
        self.logger.info(message)
    
    def load_game_data(self):
        """Load game data from file"""
        if not self.data_file.exists():
            return self.get_default_game_data()
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        except (json.JSONDecodeError, FileNotFoundError) as e:
            self.log(f'Error loading game data: {e}, using defaults')
            return self.get_default_game_data()
    
    def save_game_data(self, data):
        """Save game data to file"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            self.log(f'Error saving game data: {e}')
            return False
    
    def get_default_game_data(self):
        """Get default game data"""
        return {
            'initialized': False,
            'current_slide': 0,
            'users': 0,
            'time_remaining': DEFAULT_SLIDE_TIME,
            'game_started': False,
            'start_time': None,
            'slide_start_time': None,
            'total_slides': 0,
            'game_id': f'kahoot_{int(time.time())}',
            'created_at': datetime.now().isoformat()
        }
    
    def initialize_game(self):
        """Initialize new game"""
        data = self.get_default_game_data()
        data.update({
            'initialized': True,
            'game_started': True,
            'start_time': time.time(),
            'current_slide': 1,
            'slide_start_time': time.time(),
            'users': random.randint(5, 25),
            'time_remaining': DEFAULT_SLIDE_TIME
        })
        
        self.save_game_data(data)
        self.log(f"Game initialized with ID: {data['game_id']}, Users: {data['users']}")
        
        return data
    
    def next_slide(self):
        """Move to next slide"""
        data = self.load_game_data()
        
        if not data['initialized']:
            raise Exception('Game not initialized')
        
        data['current_slide'] += 1
        data['slide_start_time'] = time.time()
        data['time_remaining'] = DEFAULT_SLIDE_TIME
        
        # Simulate user changes
        change = random.randint(-USER_FLUCTUATION_RANGE, USER_FLUCTUATION_RANGE * 2)
        data['users'] = max(MIN_USERS, min(MAX_USERS, data['users'] + change))
        
        self.save_game_data(data)
        self.log(f"Moved to slide {data['current_slide']}, Users: {data['users']}")
        
        return data
    
    def get_user_count(self):
        """Get current user count"""
        data = self.load_game_data()
        
        if not data['initialized']:
            return 0
        
        # Simulate slight fluctuations
        fluctuation = random.randint(-1, 2)
        data['users'] = max(MIN_USERS, min(MAX_USERS, data['users'] + fluctuation))
        
        self.save_game_data(data)
        return data['users']
    
    def get_time_remaining(self):
        """Get time remaining for current slide"""
        data = self.load_game_data()
        
        if not data['initialized'] or not data['slide_start_time']:
            return DEFAULT_SLIDE_TIME
        
        elapsed = time.time() - data['slide_start_time']
        time_remaining = max(0, DEFAULT_SLIDE_TIME - elapsed)
        
        data['time_remaining'] = time_remaining
        self.save_game_data(data)
        
        return int(time_remaining)
    
    def get_game_status(self):
        """Get full game status"""
        data = self.load_game_data()
        
        # Add calculated fields
        data['uptime'] = int(time.time() - data['start_time']) if data['start_time'] else 0
        data['slide_elapsed'] = int(time.time() - data['slide_start_time']) if data['slide_start_time'] else 0
        data['server_time'] = datetime.now().isoformat()
        
        return data
    
    def reset_game(self):
        """Reset game"""
        data = self.get_default_game_data()
        self.save_game_data(data)
        self.log("Game reset")
        return data

# Initialize game manager
game = GameManager()

# Timer functions
def start_user_increment_timer(duration=30):
    """Start timer that increments users randomly during the specified duration"""
    global active_timer, timer_thread, timer_start_time, timer_duration
    
    # Force stop any existing timer first
    if active_timer or (timer_thread and timer_thread.is_alive()):
        game.log("Stopping existing timer before starting new one")
        stop_user_increment_timer()
        time.sleep(0.5)  # Give time for cleanup
    
    timer_duration = duration
    timer_start_time = time.time()
    active_timer = True
    
    game.log(f"Starting NEW timer for {duration} seconds (Thread ID will be set)")
    
    def timer_worker():
        global active_timer
        start_time = time.time()
        thread_id = threading.current_thread().ident
        
        game.log(f"Timer worker started - Thread ID: {thread_id}, Duration: {duration}s")
        
        while active_timer and (time.time() - start_time) < duration:
            if not active_timer:
                game.log(f"Timer worker {thread_id} stopping - active_timer is False")
                break
                
            # Random delay between 0.5 to 2 seconds
            delay = random.uniform(0.5, 2.0)
            time.sleep(delay)
            
            if active_timer:
                # Increment users by 1
                game_data = game.get_game_status()
                new_users = game_data['users'] + 1
                
                # Update game data
                data = game.load_game_data()
                data['users'] = new_users
                game.save_game_data(data)
                
                # Send update via WebSocket - user count only
                socketio.emit('user_update', {
                    'users': new_users,
                    'status': 'running'
                })
                
                game.log(f'Thread {thread_id}: Users incremented to {new_users}')
        
        # Timer finished
        if active_timer:  # Only if this thread is still the active one
            active_timer = False
            socketio.emit('timer_finished', {
                'users': game.get_game_status()['users'],
                'status': 'finished'
            })
            game.log(f'Timer {thread_id} finished normally, stopping user increments')
        else:
            game.log(f'Timer {thread_id} stopped by another thread')
    
    timer_thread = threading.Thread(target=timer_worker)
    timer_thread.daemon = True
    timer_thread.start()
    
    
    game.log(f'Started user increment timer for {duration} seconds')

def stop_user_increment_timer():
    """Stop the user increment timer"""
    global active_timer, timer_thread
    
    if active_timer or (timer_thread and timer_thread.is_alive()):
        game.log('Stopping user increment timer...')
        active_timer = False
        
        if timer_thread and timer_thread.is_alive():
            game.log(f'Waiting for timer thread {timer_thread.ident} to finish...')
            timer_thread.join(timeout=2)  # Increased timeout
            
            if timer_thread.is_alive():
                game.log(f'Warning: Timer thread {timer_thread.ident} did not stop gracefully')
        
        socketio.emit('timer_stopped', {
            'users': game.get_game_status()['users'],
            'status': 'stopped'
        })
        game.log('User increment timer stopped successfully')
    else:
        game.log('No active timer to stop')

# WebSocket event handlers
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    connected_clients.add(request.sid)
    game.log(f'Client connected: {request.sid}')
    
    # Send current status to newly connected client
    game_data = game.get_game_status()
    
    emit('status_update', {
        'users': game_data['users'],
        'status': 'running' if active_timer else 'stopped',
        'current_slide': game_data['current_slide']
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    connected_clients.discard(request.sid)
    game.log(f'Client disconnected: {request.sid}')

@app.route('/docs')
def index():
    """API documentation page"""
    status = game.get_game_status()
    
    html = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <title>Kahoot Quiz Server API</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 40px; direction: rtl; }}
            .endpoint {{ background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }}
            .url {{ font-family: monospace; background: #e0e0e0; padding: 5px; border-radius: 3px; }}
            .status {{ padding: 10px; background: #d4edda; border-radius: 5px; margin: 20px 0; }}
            .python-note {{ padding: 10px; background: #cce5ff; border-radius: 5px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <h1>🎯 Kahoot Quiz Server API (Python)</h1>
        
        <div class="python-note">
            <strong>🐍 Python Server</strong><br>
            זהו שרת פייתון לבדיקה מקומית.<br>
            הפעל עם: <code>python app.py</code><br>
            השרת רץ על: <code>http://localhost:5000</code>
        </div>
        
        <div class="status">
            <strong>סטטוס שרת:</strong> פעיל<br>
            <strong>גרסה:</strong> 1.0.0 (Python)<br>
            <strong>זמן שרת:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br>
            <strong>משחק מאותחל:</strong> {'כן' if status['initialized'] else 'לא'}
        </div>
        
        <h2>נקודות קצה זמינות (Endpoints)</h2>
        
        <div class="endpoint">
            <h3>🚀 אתחול משחק</h3>
            <div class="url">GET /?init</div>
            <p>מאתחל משחק חדש ומגדיר נתוני התחלה</p>
        </div>
        
        <div class="endpoint">
            <h3>➡️ מעבר לעמוד הבא</h3>
            <div class="url">GET /?next_page</div>
            <p>מעדכן שרת על מעבר לשקף הבא במצגת</p>
        </div>
        
        <div class="endpoint">
            <h3>👥 קבלת מספר משתמשים</h3>
            <div class="url">GET /?get_users</div>
            <p>מחזיר את מספר המשתתפים הנוכחי</p>
        </div>
        
        <div class="endpoint">
            <h3>⏰ קבלת זמן נותר</h3>
            <div class="url">GET /?get_time</div>
            <p>מחזיר את הזמן הנותר בשניות</p>
        </div>
        
        <div class="endpoint">
            <h3>📊 סטטוס מלא</h3>
            <div class="url">GET /?status</div>
            <p>מחזיר את כל נתוני המשחק בפורמט JSON</p>
        </div>
        
        <div class="endpoint">
            <h3>🔄 איפוס משחק</h3>
            <div class="url">GET /?reset</div>
            <p>מאפס את המשחק (פונקציית מנהל)</p>
        </div>
        
        <div class="endpoint">
            <h3>💾 שמירת מצגת</h3>
            <div class="url">POST /save</div>
            <p>שומר נתוני מצגת כ-JSON עם ID ייחודי</p>
        </div>
        
        <div class="endpoint">
            <h3>📂 טעינת מצגת</h3>
            <div class="url">POST /load</div>
            <p>טוען נתוני מצגת שמורים לפי ID</p>
        </div>
        
        <h2>מידע נוכחי</h2>
        <pre>{json.dumps(status, indent=2, ensure_ascii=False)}</pre>
        
        <hr>
        <p><small>Kahoot Quiz Server API v1.0 (Python) - תוכנן לעבודה עם PowerPoint Add-in</small></p>
    </body>
    </html>
    """
    return html

@app.route('/save', methods=['POST'])
def save_presentation():
    """Save presentation data"""
    try:
        data = request.get_json()
        
        print("=" * 50)
        print("📥 SAVE REQUEST RECEIVED:")
        print("Full JSON received:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("=" * 50)
        
        if not data or 'id' not in data or 'data' not in data:
            print("❌ ERROR: Missing id or data in request")
            return jsonify({
                'status': 'error',
                'message': 'Missing id or data in request'
            }), 400
        
        file_id = data['id']
        presentation_data = data['data']
        
        print(f"📋 Extracted data:")
        print(f"  File ID: {file_id}")
        print(f"  Presentation data keys: {list(presentation_data.keys()) if presentation_data else 'None'}")
        if 'gameState' in presentation_data:
            print(f"  Game state keys: {list(presentation_data['gameState'].keys())}")
            if 'slideTypeData' in presentation_data['gameState']:
                print(f"  📝 Slide type data: {presentation_data['gameState']['slideTypeData']}")
        
        # Ensure the saved files directory exists
        saved_files_dir = DATA_DIR / 'saved_presentations'
        saved_files_dir.mkdir(exist_ok=True)
        
        # Save the data as id.json
        save_file = saved_files_dir / f'{file_id}.json'
        
        with open(save_file, 'w', encoding='utf-8') as f:
            json.dump(presentation_data, f, indent=2, ensure_ascii=False)
        
        game.log(f'Saved presentation data to {save_file}')
        
        return jsonify({
            'status': 'success',
            'message': 'Presentation saved successfully',
            'id': file_id,
            'filename': presentation_data.get('filename', 'Unknown')
        })
        
    except Exception as e:
        game.log(f'Error saving presentation: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error saving presentation: {str(e)}'
        }), 500

@app.route('/load', methods=['POST'])
def load_presentation():
    """Load presentation data"""
    try:
        data = request.get_json()
        
        if not data or 'id' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing id in request'
            }), 400
        
        file_id = data['id']
        
        # Look for the saved file
        saved_files_dir = DATA_DIR / 'saved_presentations'
        save_file = saved_files_dir / f'{file_id}.json'
        
        if not save_file.exists():
            return jsonify({
                'status': 'error',
                'message': 'No saved data found for this presentation'
            }), 404
        
        # Load the data
        with open(save_file, 'r', encoding='utf-8') as f:
            presentation_data = json.load(f)
        
        game.log(f'Loaded presentation data from {save_file}')
        
        return jsonify({
            'status': 'success',
            'message': 'Presentation loaded successfully',
            'data': presentation_data
        })
        
    except Exception as e:
        game.log(f'Error loading presentation: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error loading presentation: {str(e)}'
        }), 500

@app.route('/', methods=['GET'])
def api_handler():
    """Handle API requests"""
    try:
        # Determine action from query parameters
        if 'init' in request.args:
            action = 'init'
        elif 'next_page' in request.args:
            action = 'next_page'
        elif 'get_users' in request.args:
            action = 'get_users'
        elif 'get_time' in request.args:
            action = 'get_time'
        elif 'status' in request.args:
            action = 'status'
        elif 'reset' in request.args:
            action = 'reset'
        elif 'start' in request.args:
            action = 'start'
        elif 'stop' in request.args:
            action = 'stop'
        else:
            return index()
        
        # Handle different actions
        if action == 'init':
            # Generate random 6-digit game ID
            game_id = random.randint(100000, 999999)
            return jsonify({
                'game_id': game_id
            })
        
        elif action == 'next_page':
            try:
                game_data = game.next_slide()
                return jsonify({
                    'status': 'success',
                    'slide': game_data['current_slide'],
                    'users': game_data['users'],
                    'time': game_data['time_remaining']
                })
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)}), 400
        
        elif action == 'get_users':
            users = game.get_user_count()
            return str(users)
        
        elif action == 'get_time':
            time_remaining = game.get_time_remaining()
            return str(time_remaining)
        
        elif action == 'status':
            status = game.get_game_status()
            return jsonify(status)
        
        elif action == 'reset':
            game_data = game.reset_game()
            return jsonify({
                'status': 'reset',
                'message': 'Game has been reset',
                'data': game_data
            })
        
        elif action == 'start':
            # Get time parameter (default 30 seconds)
            duration = int(request.args.get('time', 30))
            duration = max(1, min(300, duration))  # Limit between 1-300 seconds
            
            # Reset users count and start timer
            data = game.load_game_data()
            data['users'] = 1  # Start with 1 user
            data['time_remaining'] = duration
            game.save_game_data(data)
            
            # Start the timer
            start_user_increment_timer(duration)
            
            return jsonify({
                'status': 'started',
                'message': f'Timer started for {duration} seconds',
                'duration': duration,
                'users': 1
            })
        
        elif action == 'stop':
            # Stop the timer
            stop_user_increment_timer()
            
            game_data = game.get_game_status()
            return jsonify({
                'status': 'stopped',
                'message': 'Timer has been stopped',
                'users': game_data['users'],
                'time_remaining': 0
            })
    
    except Exception as e:
        game.log(f'Error: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("🎯 Starting Kahoot Quiz Server (Python)")
    print("=" * 40)
    print("Server will run on: http://localhost:5000")
    print("API Documentation: http://localhost:5000/docs")
    print("WebSocket URL: ws://localhost:5000")
    print("")
    print("Available endpoints:")
    print("  /?init          - Initialize game")
    print("  /?next_page     - Next slide")
    print("  /?get_users     - Get user count")
    print("  /?get_time      - Get time remaining")
    print("  /?status        - Get full status")
    print("  /?reset         - Reset game")
    print("  /?start[&time=X] - Start timer (default 30s)")
    print("  /?stop          - Stop timer")
    print("  /save           - Save presentation data (POST)")
    print("  /load           - Load presentation data (POST)")
    print("")
    print("WebSocket Events:")
    print("  user_update     - Real-time user count updates")
    print("  timer_finished  - Timer completion")
    print("  timer_stopped   - Timer manual stop")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

