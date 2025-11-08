#!/usr/bin/env python3
"""
Kahoot Quiz Server - Python Flask Implementation

Server-side component for the PowerPoint Kahoot Add-in
Run locally for testing: python app.py
Deploy to server: see deployment instructions
"""

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import os
import time
import random
import threading
from datetime import datetime
import logging
from pathlib import Path
import qrcode
from io import BytesIO

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'kahoot_quiz_secret_key_2024'

# Initialize SocketIO
socketio = SocketIO(app, 
    cors_allowed_origins="*",  # Allow all origins for development
    logger=False,
    engineio_logger=False
)

# Configure CORS
CORS(app, origins="*")  # Allow all origins for development

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
LOG_DIR = Path(__file__).parent / 'logs'
GAME_DATA_FILE = DATA_DIR / 'game_data.json'
LOG_FILE = LOG_DIR / 'kahoot.log'

# Note: Hash generation is now done client-side in add-in
# The server only receives and validates the hash ID

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

# Hash-based room system: maps session_id -> hash_id
client_rooms = {}  # e.g., {'session123': 'a65445f6664e', 'session456': 'f049ebb08096'}

# Game sessions: maps hash_id -> session info
game_sessions = {}  # e.g., {'a65445f6664e': {'sessionId': '123456', 'timestamp': 1234567890}}

def emit_to_room(event, data, target_hash_id):
    """
    Emit a message only to clients in a specific room (hash ID).
    
    Args:
        event: The event name
        data: The data to send
        target_hash_id: The hash ID of the room to send to
    """
    # Count clients in this room
    sent_count = sum(1 for hash_id in client_rooms.values() if hash_id == target_hash_id)
    
    if sent_count > 0:
        game.log(f'📤 Sending {event} to room {target_hash_id} ({sent_count} client(s))')
        socketio.emit(event, data, room=target_hash_id)
    else:
        game.log(f'⚠️ No clients in room {target_hash_id} to send {event}')
    
    return sent_count

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
        
        # If not initialized, just use basic defaults without full initialization
        if not data['initialized']:
            data['current_slide'] = data.get('current_slide', 0)
            data['users'] = data.get('users', 10)  # Default user count
            data['time_remaining'] = DEFAULT_SLIDE_TIME
            data['slide_start_time'] = time.time()
        
        data['current_slide'] += 1
        data['slide_start_time'] = time.time()
        data['time_remaining'] = DEFAULT_SLIDE_TIME
        
        # Keep user count stable or slight change
        if 'users' not in data or data['users'] == 0:
            data['users'] = 10  # Default
        else:
            # Small user fluctuation
            change = random.randint(-2, 3)
            data['users'] = max(1, data['users'] + change)
        
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

@socketio.on('register_room')
def handle_register_room(data):
    """Register client with a specific hash ID (room)"""
    hash_id = data.get('hashId')
    if hash_id:
        # Join Socket.IO room
        join_room(hash_id)
        
        # Track in our mapping
        client_rooms[request.sid] = hash_id
        
        game.log(f'✅ Client {request.sid} joined room (hash): {hash_id}')
        emit('room_registered', {'hashId': hash_id, 'status': 'success'})
    else:
        game.log(f'❌ Client {request.sid} failed to register - no hashId provided')
        emit('room_registered', {'status': 'error', 'message': 'No hashId provided'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    connected_clients.discard(request.sid)
    
    # Leave Socket.IO room and remove from mapping
    if request.sid in client_rooms:
        hash_id = client_rooms[request.sid]
        leave_room(hash_id)
        del client_rooms[request.sid]
        game.log(f'Client disconnected from room {hash_id}: {request.sid}')
    else:
        game.log(f'Client disconnected: {request.sid}')

@socketio.on('participant_update')
def handle_participant_update(data):
    """Handle participant add/remove updates - room-aware"""
    try:
        game.log(f'Received participant_update: {data}')
        
        # Get hash ID from data or from sender's room
        hash_id = data.get('hashId')
        if not hash_id and request.sid in client_rooms:
            hash_id = client_rooms[request.sid]
        
        if hash_id:
            # Broadcast to specific room only
            emit_to_room('participant_update', data, hash_id)
            
            # Also send a general user update for compatibility
            if 'total' in data:
                emit_to_room('user_update', {
                    'users': data['total'],
                    'total': data['total']
                }, hash_id)
            
            game.log(f'Sent participant update to room {hash_id}: {data["nick"]} {data["type"]}')
        else:
            # Fallback: broadcast to all if no hash ID
            game.log(f'Warning: No hash ID for participant_update, broadcasting to all')
            socketio.emit('participant_update', data)
            if 'total' in data:
                socketio.emit('user_update', {
                    'users': data['total'],
                    'total': data['total']
                })
        
    except Exception as e:
        game.log(f'Error handling participant update: {e}')

@socketio.on('user_update')
def handle_user_update(data):
    """Handle general user count updates - room-aware"""
    try:
        game.log(f'Received user_update: {data}')
        
        # Get hash ID from data or from sender's room
        hash_id = data.get('hashId')
        if not hash_id and request.sid in client_rooms:
            hash_id = client_rooms[request.sid]
        
        if hash_id:
            # Broadcast to specific room only
            emit_to_room('user_update', data, hash_id)
            game.log(f'Sent user_update to room {hash_id}')
        else:
            # Fallback: broadcast to all if no hash ID
            game.log(f'Warning: No hash ID for user_update, broadcasting to all')
            socketio.emit('user_update', data)
        
    except Exception as e:
        game.log(f'Error handling user update: {e}')

@app.route('/debug_save_location.html')
def debug_save_location():
    """Serve the save location debug page"""
    return send_from_directory('.', 'debug_save_location.html')

@app.route('/participants_widget')
def serve_participants_widget():
    """Serve the participants widget HTML for embedding in PowerPoint slides"""
    html_content = """
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>משתתפים פעילים</title>
        <style>
            body {
                font-family: "Segoe UI", "Segoe UI Web (West European)", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
                background-color: #f3f2f1;
                padding: 15px;
                margin: 0;
                direction: rtl;
                border-radius: 4px;
                border: 2px solid #0078d4;
                height: 100vh;
                box-sizing: border-box;
                overflow: hidden;
            }
            
            h4 {
                margin: 0 0 10px 0;
                text-align: center;
                color: #0078d4;
                font-size: 14px;
                font-weight: bold;
            }
            
            .participants-container {
                min-height: 80px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 6px;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            
            .participant-item {
                background: linear-gradient(135deg, #0078d4, #106ebe);
                color: white;
                padding: 6px 10px;
                border-radius: 18px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 6px rgba(0,120,212,0.3);
                transition: all 0.3s ease;
                animation: slideIn 0.3s ease-out;
                white-space: nowrap;
            }
            
            .stats {
                text-align: center;
                font-size: 11px;
                color: #666;
                font-weight: bold;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .no-participants {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 15px;
                font-size: 12px;
            }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>
    </head>
    <body>
        <h4>משתתפים פעילים</h4>
        <div class="participants-container" id="participantsContainer">
            <div class="no-participants">מחכים למשתתפים...</div>
        </div>
        <div class="stats">
            סה"כ משתתפים: <span id="totalCount">0</span>
        </div>

        <script>
            let participantsList = [];
            
            // Initialize Socket.IO connection
            const socket = io('http://localhost:5000');
            
            socket.on('connect', function() {
                console.log('🌐 Widget connected to server');
            });
            
            socket.on('participant_update', function(data) {
                console.log('👥 Widget participant update received:', data);
                handleParticipantUpdate(data);
            });
            
            function handleParticipantUpdate(data) {
                const { nick, type, total } = data;
                
                if (type === 'add') {
                    if (!participantsList.includes(nick)) {
                        participantsList.push(nick);
                        addParticipantToUI(nick);
                    }
                } else if (type === 'remove') {
                    const index = participantsList.indexOf(nick);
                    if (index > -1) {
                        participantsList.splice(index, 1);
                        removeParticipantFromUI(nick);
                    }
                }
                
                updateStats();
            }
            
            function addParticipantToUI(nickname) {
                const container = document.getElementById('participantsContainer');
                
                // Remove "no participants" message if present
                const noParticipants = container.querySelector('.no-participants');
                if (noParticipants) {
                    noParticipants.remove();
                }
                
                // Create participant element
                const participantDiv = document.createElement('div');
                participantDiv.className = 'participant-item';
                participantDiv.textContent = nickname;
                participantDiv.setAttribute('data-participant', nickname);
                
                container.appendChild(participantDiv);
            }
            
            function removeParticipantFromUI(nickname) {
                const container = document.getElementById('participantsContainer');
                const participantDiv = container.querySelector('[data-participant="' + nickname + '"]');
                
                if (participantDiv) {
                    participantDiv.remove();
                }
                
                // Show "no participants" message if empty
                if (participantsList.length === 0) {
                    const noParticipants = document.createElement('div');
                    noParticipants.className = 'no-participants';
                    noParticipants.textContent = 'מחכים למשתתפים...';
                    container.appendChild(noParticipants);
                }
            }
            
            function updateStats() {
                document.getElementById('totalCount').textContent = participantsList.length;
            }
        </script>
    </body>
    </html>
    """
    return html_content

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
        
        <div class="note" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0;">� הערה חשובה - מבנה המערכת</h4>
            <p><strong>מזהה משחק (Hash ID):</strong> מזהה ייחודי המחושב מנתיב קובץ המצגת (12 תווים הקסדצימליים)</p>
            <p><strong>קוד משחק (Game PIN):</strong> קוד בן 6 ספרות שמשתתפים משתמשים בו כדי להצטרף למשחק</p>
            <p><strong>מזהה משתתף (UID):</strong> מזהה ייחודי שהשרת מייצר לכל משתתף בעת ההצטרפות</p>
        </div>
        
        <h3>🎮 ניהול משחק</h3>
        
        <div class="endpoint">
            <h3>🎯 רישום סשן משחק</h3>
            <div class="url">GET /?register_session&amp;hash_id=HASH&amp;game_pin=PIN</div>
            <p>רושם סשן משחק חדש עם hash_id (מזהה מצגת) ו-game_pin (קוד כניסה למשחק)</p>
            <p><strong>מבצע גם:</strong> איפוס המצגת לשקף הראשון אוטומטית</p>
            <p><strong>דוגמה:</strong> <code>/?register_session&hash_id=00007236196d&game_pin=123456</code></p>
        </div>
        
        <h3>👥 ניהול משתתפים</h3>
        
        <div class="endpoint">
            <h3>🚪 התחל קבלת משתתפים</h3>
            <div class="url">GET /?start_accepting_participants&amp;hash_id=HASH</div>
            <p><strong>נקרא אוטומטית:</strong> כשנכנסים לשקף "פתיחה"</p>
            <p>מאפשר קבלת משתתפים חדשים למשחק</p>
        </div>
        
        <div class="endpoint">
            <h3>🚫 הפסק קבלת משתתפים</h3>
            <div class="url">GET /?stop_accepting_participants&amp;hash_id=HASH</div>
            <p><strong>נקרא אוטומטית:</strong> כשעוברים לשקף הבא אחרי "פתיחה"</p>
            <p>חוסם קבלת משתתפים חדשים (מחזיר שגיאה 403)</p>
        </div>
        
        <div class="endpoint">
            <h3>➕ הצטרפות משתתף</h3>
            <div class="url">POST /?join_player</div>
            <p><strong>JSON Body:</strong> <code>{{"game_pin": "123456", "name": "שם"}}</code></p>
            <p><strong>מחזיר:</strong> <code>{{"status": "success", "uid": "unique-id-123"}}</code></p>
            <p>ה-uid מיוצר על-ידי השרת ונשלח בכל בקשה עתידית ב-header: <code>access_token: uid</code></p>
            <p>מוסיף משתתף למשחק (רק אם המשחק בשקף "פתיחה")</p>
        </div>
        
        <div class="endpoint">
            <h3>➖ ניתוק משתתף</h3>
            <div class="url">POST /?leave_player</div>
            <p><strong>Headers:</strong> <code>access_token: uid</code></p>
            <p><strong>Body:</strong> לא נדרש (השרת מזהה את המשתתף לפי ה-access_token)</p>
            <p>מסיר משתתף מהמשחק ומוחק את ה-uid מהמערכת</p>
        </div>
        
        <h3>🧭 ניווט ובקרה</h3>
        
        <div class="endpoint">
            <h3>➡️ מעבר לשקף הבא</h3>
            <div class="url">GET /?next_page&amp;hash_id=HASH (או /?next_slide)</div>
            <p>שולח פקודת WebSocket ל-add-in לעבור לשקף הבא במצגת</p>
            <p><strong>דוגמה:</strong> <code>/?next_slide&hash_id=00007236196d</code></p>
        </div>
        
        <h3>📊 מידע ונתונים</h3>
        
        <div class="endpoint">
            <h3>� סטטוס מלא</h3>
            <div class="url">GET /?status</div>
            <p>מחזיר את כל נתוני המשחק בפורמט JSON</p>
        </div>
        
        <div class="endpoint">
            <h3>🎮 מידע על משחק</h3>
            <div class="url">GET /game-info/HASH_ID</div>
            <p>מחזיר מידע על משחק כולל URL לאדמין וקוד QR</p>
        </div>
        
        <div class="endpoint">
            <h3>� קוד QR לאדמין</h3>
            <div class="url">GET /qr-code/HASH_ID</div>
            <p>מחזיר תמונת QR לכניסת אדמין (פורט 3002)</p>
            <p><strong>דוגמה:</strong> <code>/qr-code/00007236196d</code></p>
        </div>
        
        <div class="endpoint">
            <h3>📱 קוד QR לשחקנים</h3>
            <div class="url">GET /qr-code-player/GAME_PIN</div>
            <p>מחזיר תמונת QR לכניסת שחקנים (פורט 8080)</p>
            <p><strong>דוגמה:</strong> <code>/qr-code-player/123456</code> או <code>/qr-code-player/123-456</code></p>
        </div>
        
        <h3>💾 שמירה וטעינה</h3>
        
        <div class="endpoint">
            <h3>� שמירת מצגת</h3>
            <div class="url">POST /save</div>
            <p><strong>JSON Body:</strong> <code>{{"hashId": "HASH", "data": {{...}}}}</code></p>
            <p>שומר נתוני מצגת לפי hash ID</p>
            <p><strong>מבנה הנתונים:</strong> slideTypeData (מסודר לפי UUID של שקפים), presentationSettings</p>
            <p><strong>מיקום:</strong> <code>srv/data/saved_presentations/{{hash_id}}.json</code></p>
        </div>
        
        <div class="endpoint">
            <h3>� טעינת מצגת</h3>
            <div class="url">POST /load</div>
            <p><strong>JSON Body:</strong> <code>{{"hashId": "HASH"}}</code></p>
            <p>טוען נתוני מצגת שמורים לפי hash ID</p>
        </div>
        
        <h3>🔌 WebSocket Events</h3>
        
        <div class="endpoint">
            <h3>� אירועים זמינים</h3>
            <div class="url">ws://localhost:5000</div>
            <p><strong>participant_update:</strong> עדכון על הוספה/הסרה של משתתף בודד</p>
            <p><strong>user_update:</strong> עדכון כללי על מספר המשתתפים</p>
            <p><strong>slide_navigation:</strong> פקודות ניווט בין שקפים</p>
            <p><strong>game_pin_registered:</strong> אישור רישום קוד משחק</p>
            <p><strong>timer_finished:</strong> סיום טיימר</p>
            <p><strong>timer_stopped:</strong> עצירה ידנית של טיימר</p>
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
    """
    Save presentation data by presentation path.
    
    The client sends the full presentation path, and the server creates
    a unique hash ID from it. This ensures:
    - Consistency: Same path always gets same hash
    - Security: Hash generation controlled by server
    - Uniqueness: Different paths get different hashes
    
    IMPORTANT: This server does NOT cache presentation data in memory.
    All data is saved directly to files (data/saved_presentations/{hash_id}.json).
    The slideTypeData is stored with slide IDs (UUIDs) as keys, NOT slide numbers.
    This ensures slide types persist even if slides are reordered.
    """
    try:
        data = request.get_json()
        
        print("=" * 50)
        print("📥 SAVE REQUEST RECEIVED:")
        print("Full JSON received:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print("=" * 50)
        
        # Check for required fields - now expecting hashId instead of presentationPath
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
        
        # Additional sanitization for extra safety
        import re
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
        saved_files_dir = DATA_DIR / 'saved_presentations'
        saved_files_dir.mkdir(exist_ok=True)
        
        # Save the data as hash_id.json (NO CACHE - direct to file)
        # IMPORTANT: saved_files_dir is ALWAYS srv/data/saved_presentations/
        # hash_id is generated by server from path (secure)
        save_file = saved_files_dir / f'{hash_id}.json'
        
        # Final safety check: make sure save_file is inside saved_files_dir
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

@app.route('/list_saved_files', methods=['GET'])
def list_saved_files():
    """List all saved presentation files"""
    try:
        saved_files_dir = DATA_DIR / 'saved_presentations'
        
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


@app.route('/game-info/<hash_id>', methods=['GET'])
def get_game_info(hash_id):
    """
    Get game information including QR code for a specific game hash.
    This supports multiple games running in parallel by hash ID.
    
    Args:
        hash_id: The game hash ID
        
    Returns:
        JSON with game URL and QR code data
    """
    try:
        print("=" * 50)
        print(f"📋 GAME INFO REQUEST for hash: {hash_id}")
        
        # Validate hash ID
        if not hash_id or not isinstance(hash_id, str) or hash_id.strip() == '':
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID'
            }), 400
        
        # Sanitize hash ID
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID length'
            }), 400
        
        # Build admin URL (for QR code in "Start Game" button)
        # Admin joins via port 3002 with hashId
        # TODO: Make this configurable via environment variable
        admin_url = f'http://192.168.31.22:3002/{hash_id}'
        
        game.log(f'✅ Generated game info for hash: {hash_id}')
        game.log(f'   Admin URL: {admin_url}')
        
        return jsonify({
            'status': 'success',
            'hashId': hash_id,
            'adminUrl': admin_url,
            'qrCodeUrl': f'/qr-code/{hash_id}'  # QR for admin (port 3002)
        })
        
    except Exception as e:
        game.log(f'❌ Error generating game info: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }), 500

@app.route('/qr-code/<hash_id>', methods=['GET'])
def get_qr_code(hash_id):
    """
    Generate and return QR code image for admin (uses hash_id).
    
    Args:
        hash_id: The game hash ID
        
    Returns:
        PNG image of QR code
    """
    try:
        # Validate and sanitize hash ID
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            return "Invalid hash ID", 400
        
        # Build admin URL (port 3002)
        admin_url = f'http://192.168.31.22:3002/{hash_id}'
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(admin_url)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="#0078d4", back_color="white")
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        game.log(f'✅ Generated QR code for admin with hash: {hash_id}')
        
        return send_file(img_io, mimetype='image/png', as_attachment=False)
        
    except Exception as e:
        game.log(f'❌ Error generating QR code: {str(e)}')
        return f"Error generating QR code: {str(e)}", 500

@app.route('/qr-code-player/<game_pin>', methods=['GET'])
def get_qr_code_player(game_pin):
    """
    Generate and return QR code image for players (uses game_pin).
    This is for the opening slide - players scan to join the game.
    
    Args:
        game_pin: The 6-digit game PIN (e.g., "123456" or "123-456")
        
    Returns:
        PNG image of QR code
    """
    try:
        # Validate and sanitize game PIN
        import re
        game_pin_clean = re.sub(r'[^0-9]', '', game_pin)
        
        if len(game_pin_clean) != 6:
            return "Invalid game PIN - must be 6 digits", 400
        
        # Format as XXX-XXX
        formatted_pin = f'{game_pin_clean[:3]}-{game_pin_clean[3:]}'
        
        # Build player URL (port 8080)
        player_url = f'http://192.168.31.22:8080/{formatted_pin}'
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(player_url)
        qr.make(fit=True)
        
        # Create image with different color for player QR (green)
        img = qr.make_image(fill_color="#16a085", back_color="white")
        
        # Save to BytesIO
        img_io = BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        game.log(f'✅ Generated player QR code for game PIN: {formatted_pin}')
        
        return send_file(img_io, mimetype='image/png', as_attachment=False)
        
    except Exception as e:
        game.log(f'❌ Error generating player QR code: {str(e)}')
        return f"Error generating QR code: {str(e)}", 500

@app.route('/load', methods=['POST'])
def load_presentation():
    """
    Load presentation data by hash ID.
    
    The client generates the hash ID from the presentation path and sends it directly.
    
    IMPORTANT: This server does NOT cache presentation data in memory.
    All data is loaded directly from files (data/saved_presentations/{hash_id}.json).
    The slideTypeData will be loaded with slide IDs (UUIDs) as keys, NOT slide numbers.
    This ensures the client can restore slide types by ID regardless of slide order.
    """
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
        
        # Additional sanitization for extra safety
        import re
        hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
        
        if len(hash_id) < 8 or len(hash_id) > 20:
            print(f"❌ ERROR: Hash ID length out of range: {len(hash_id)}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid hash ID length'
            }), 400
        
        print(f"  Hash ID (sanitized): {hash_id}")
        
        # Look for the saved file by Hash ID (NO CACHE - direct from file)
        saved_files_dir = DATA_DIR / 'saved_presentations'
        save_file = saved_files_dir / f'{hash_id}.json'
        
        # Final safety check: make sure save_file is inside saved_files_dir
        if not str(save_file.resolve()).startswith(str(saved_files_dir.resolve())):
            print(f"❌ SECURITY ERROR: Attempted path traversal!")
            print(f"   Attempted path: {save_file}")
            print(f"   Allowed directory: {saved_files_dir}")
            return jsonify({
                'status': 'error',
                'message': 'Invalid file path'
            }), 400
        
        if not save_file.exists():
            print(f"❌ No saved file found: {save_file}")
            game.log(f'No saved data found for hash ID: {hash_id}')
            return jsonify({
                'status': 'error',
                'message': 'No saved data found for this presentation'
            }), 404
        
        # Load the data directly from file (NO CACHE)
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

@app.route('/', methods=['GET', 'POST'])
def api_handler():
    """Handle API requests"""
    try:
        # Determine action from query parameters
        if 'init' in request.args:
            action = 'init'
        elif 'join_player' in request.args:
            action = 'join_player'
        elif 'leave_player' in request.args:
            action = 'leave_player'
        elif 'register_session' in request.args:
            action = 'register_session'
        elif 'next_page' in request.args:
            action = 'next_page'
        elif 'next_slide' in request.args:
            action = 'next_slide'
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
        elif 'click_action' in request.args:
            action = 'click_action'
        elif 'reset_animations' in request.args:
            action = 'reset_animations'
        else:
            return index()
        
        # Handle different actions
        if action == 'init':
            # Generate random 6-digit game ID
            game_id = random.randint(100000, 999999)
            return jsonify({
                'game_id': game_id
            })
        
        elif action == 'join_player':
            # Player joins game by game PIN
            try:
                # Get JSON data from POST request
                data = request.get_json()
                if not data:
                    return jsonify({
                        'status': 'error',
                        'message': 'No JSON data provided'
                    }), 400
                
                game_pin = data.get('game_pin', '').strip()
                user_id = data.get('user_id', '').strip()
                name = data.get('name', '').strip()
                
                if not game_pin or not user_id or not name:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing game_pin, user_id, or name'
                    }), 400
                
                # Sanitize inputs
                import re
                game_pin = re.sub(r'[^0-9]', '', game_pin)
                
                if len(game_pin) != 6:
                    return jsonify({
                        'status': 'error',
                        'message': 'Game PIN must be 6 digits'
                    }), 400
                
                # Find hash_id for this game_pin
                hash_id = None
                for h_id, session in game_sessions.items():
                    if session.get('gamePin') == game_pin:
                        hash_id = h_id
                        break
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': f'No active game found with PIN {game_pin}'
                    }), 404
                
                game.log(f'👥 Player joining: {name} (ID: {user_id}) to game PIN: {game_pin} (hash: {hash_id})')
                
                # Send participant update to add-ins in this specific game room
                participant_data = {
                    'nick': name,
                    'type': 'add',
                    'user_id': user_id,
                    'timestamp': time.time()
                }
                
                sent = emit_to_room('participant_update', participant_data, hash_id)
                
                game.log(f'📤 Sent participant_update (add) to {sent} client(s) in room {hash_id}')
                
                return jsonify({
                    'status': 'success',
                    'message': f'Player {name} joined game {game_pin}',
                    'hashId': hash_id,
                    'gamePin': game_pin
                })
                
            except Exception as e:
                game.log(f'❌ Error in join_player: {str(e)}')
                import traceback
                traceback.print_exc()
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'leave_player':
            # Player leaves game by game PIN
            try:
                # Get JSON data from POST request
                data = request.get_json()
                if not data:
                    return jsonify({
                        'status': 'error',
                        'message': 'No JSON data provided'
                    }), 400
                
                game_pin = data.get('game_pin', '').strip()
                user_id = data.get('user_id', '').strip()
                
                if not game_pin or not user_id:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing game_pin or user_id'
                    }), 400
                
                # Sanitize inputs
                import re
                game_pin = re.sub(r'[^0-9]', '', game_pin)
                
                if len(game_pin) != 6:
                    return jsonify({
                        'status': 'error',
                        'message': 'Game PIN must be 6 digits'
                    }), 400
                
                # Find hash_id for this game_pin
                hash_id = None
                for h_id, session in game_sessions.items():
                    if session.get('gamePin') == game_pin:
                        hash_id = h_id
                        break
                
                if not hash_id:
                    return jsonify({
                        'status': 'error',
                        'message': f'No active game found with PIN {game_pin}'
                    }), 404
                
                game.log(f'👋 Player leaving: ID: {user_id} from game PIN: {game_pin} (hash: {hash_id})')
                
                # Send participant update to add-ins in this specific game room
                # Note: We send the remove event first, then clients will update their own count
                participant_data = {
                    'nick': user_id,  # Use user_id as identifier
                    'type': 'remove',
                    'user_id': user_id,
                    'timestamp': time.time()
                }
                
                sent = emit_to_room('participant_update', participant_data, hash_id)
                
                game.log(f'📤 Sent participant_update (remove) to {sent} client(s) in room {hash_id}')
                
                return jsonify({
                    'status': 'success',
                    'message': f'Player {user_id} left game {game_pin}',
                    'hashId': hash_id,
                    'gamePin': game_pin
                })
                
            except Exception as e:
                game.log(f'❌ Error in leave_player: {str(e)}')
                import traceback
                traceback.print_exc()
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'register_session':
            # Admin registers a new game session
            try:
                hash_id = request.args.get('hash_id')
                game_pin = request.args.get('game_pin')
                
                if not hash_id or not game_pin:
                    return jsonify({
                        'status': 'error',
                        'message': 'Missing hash_id or game_pin'
                    }), 400
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                game_pin = re.sub(r'[^0-9]', '', game_pin)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash_id length'
                    }), 400
                
                if len(game_pin) != 6:
                    return jsonify({
                        'status': 'error',
                        'message': 'Game PIN must be 6 digits'
                    }), 400
                
                # Store session
                game_sessions[hash_id] = {
                    'gamePin': game_pin,
                    'timestamp': time.time(),
                    'active': True
                }
                
                game.log(f'✅ Session registered: hash={hash_id}, PIN={game_pin}')
                game.log(f'📊 Current client_rooms: {client_rooms}')
                
                # Notify add-in in this game room
                clients_in_room = sum(1 for h in client_rooms.values() if h == hash_id)
                game.log(f'🔍 Clients in room {hash_id}: {clients_in_room}')
                
                sent = emit_to_room('game_pin_registered', {
                    'gamePin': game_pin,
                    'hashId': hash_id,
                    'timestamp': time.time()
                }, hash_id)
                
                game.log(f'📤 Sent game_pin_registered to {sent} client(s)')
                
                # Also reset presentation to first slide (integrated logic)
                game.log(f'📍 Resetting to first slide for game: {hash_id}')
                
                reset_command = {
                    'action': 'go_to_first_slide',
                    'timestamp': time.time(),
                    'hashId': hash_id
                }
                
                reset_sent = emit_to_room('slide_navigation', reset_command, hash_id)
                game.log(f'📤 Sent reset command to {reset_sent} client(s)')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Session registered successfully',
                    'hashId': hash_id,
                    'gamePin': game_pin,
                    'resetSent': reset_sent > 0
                })
                
            except Exception as e:
                game.log(f'❌ Error in register_session: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        
        elif action == 'next_page' or action == 'next_slide':
            try:
                # Get hash_id from request (sent by admin)
                hash_id = request.args.get('hash_id')
                
                if not hash_id:
                    game.log('⚠️ Next slide request without hash_id - broadcasting to all')
                    # Fallback: broadcast to all if no hash_id (for backwards compatibility)
                    slide_command = {
                        'action': 'go_to_next_slide',
                        'timestamp': time.time()
                    }
                    socketio.emit('slide_navigation', slide_command)
                    
                    return jsonify({
                        'status': 'success',
                        'message': 'Next slide command sent to all clients',
                        'action': 'go_to_next_slide'
                    })
                
                # Validate and sanitize hash_id
                import re
                hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
                
                if len(hash_id) < 8 or len(hash_id) > 20:
                    return jsonify({
                        'status': 'error',
                        'message': 'Invalid hash ID length'
                    }), 400
                
                # Send WebSocket message ONLY to add-ins in this specific game room
                slide_command = {
                    'action': 'go_to_next_slide',
                    'timestamp': time.time(),
                    'hashId': hash_id
                }
                
                # Use emit_to_room to send only to clients in this game
                sent_count = emit_to_room('slide_navigation', slide_command, hash_id)
                
                if sent_count > 0:
                    game.log(f'✅ Next slide command sent to {sent_count} client(s) in game {hash_id}')
                    return jsonify({
                        'status': 'success',
                        'message': f'Next slide command sent to {sent_count} client(s) in game {hash_id}',
                        'action': 'go_to_next_slide',
                        'hashId': hash_id,
                        'clientsNotified': sent_count
                    })
                else:
                    game.log(f'⚠️ No clients found in game {hash_id}')
                    return jsonify({
                        'status': 'warning',
                        'message': f'No clients connected to game {hash_id}',
                        'hashId': hash_id
                    }), 404
                    
            except Exception as e:
                game.log(f'❌ Error in next_slide: {str(e)}')
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
        
        elif action == 'click_action':
            try:
                game.log('Spacebar simulation request received')
                
                # Send WebSocket message to add-in to simulate spacebar press
                spacebar_command = {
                    'action': 'simulate_click',
                    'timestamp': time.time()
                }
                
                # Broadcast spacebar command to all connected clients (including add-in)
                socketio.emit('click_navigation', spacebar_command)
                
                game.log('Spacebar simulation command sent to add-in via WebSocket')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Spacebar simulation command sent to add-in',
                    'action': 'simulate_click'
                })
                
            except Exception as e:
                game.log(f'Error in click_action endpoint: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': f'Server error in click_action: {str(e)}'
                }), 500
        
        elif action == 'reset_animations':
            try:
                game.log('Reset animations request received')
                
                # Send WebSocket message to add-in to reset animation state
                reset_command = {
                    'action': 'reset_animations',
                    'timestamp': time.time()
                }
                
                # Broadcast reset command to all connected clients (including add-in)
                socketio.emit('animation_reset', reset_command)
                
                game.log('Animation reset command sent to add-in via WebSocket')
                
                return jsonify({
                    'status': 'success',
                    'message': 'Animation reset command sent to add-in',
                    'action': 'reset_animations'
                })
                
            except Exception as e:
                game.log(f'Error in reset_animations endpoint: {str(e)}')
                return jsonify({
                    'status': 'error',
                    'message': f'Server error in reset_animations: {str(e)}'
                }), 500
    
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
    print("Participants Widget: http://localhost:5000/participants_widget")
    print("WebSocket URL: ws://localhost:5000")
    print("")
    print("Available endpoints:")
    print("  /?init          - Initialize game")
    print("  /?next_page     - Next slide (also /?next_slide)")
    print("  /?click_action  - Simulate spacebar press (animations/next slide)")
    print("  /?get_users     - Get user count")
    print("  /?get_time      - Get time remaining")
    print("  /?status        - Get full status")
    print("  /?reset         - Reset game")
    print("  /?start[&time=X] - Start timer (default 30s)")
    print("  /?stop          - Stop timer")
    print("  /save           - Save presentation data by Window ID (POST)")
    print("  /load           - Load presentation data by Window ID (POST)")
    print("")
    print("WebSocket Events (sent to add-in):")
    print("  participant_update - Individual participant add/remove")
    print("  user_update     - Real-time user count updates")
    print("  slide_navigation - Next slide navigation commands")
    print("  click_navigation - Click simulation commands")
    print("  slide_change    - Slide navigation events (legacy)")
    print("  timer_finished  - Timer completion")
    print("  timer_stopped   - Timer manual stop")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 40)
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

