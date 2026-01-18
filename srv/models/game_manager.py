"""
Game Manager class for Kahoot Quiz Server.
Handles game state, data persistence, and game lifecycle.
"""

import json
import time
import random
import logging
from datetime import datetime
from pathlib import Path


# Default settings
DEFAULT_SLIDE_TIME = 30
MIN_USERS = 1
MAX_USERS = 100


class GameManager:
    """Game Manager Class for Kahoot Quiz Server"""
    
    def __init__(self, data_file: Path):
        """
        Initialize the GameManager.
        
        Args:
            data_file: Path to the game data JSON file
        """
        self.data_file = data_file
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
