"""
Configuration file for Kahoot Quiz Server (Python)

IMPORTANT: Update ALLOWED_ORIGINS with your actual domain before deploying!
"""

import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).parent

# Security settings
ALLOWED_ORIGINS = [
    'https://localhost:3000',           # Add-in development (local)
    'https://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://din-online.co.il',         # Your server domain
    'https://www.din-online.co.il',     # WWW version
    'http://din-online.co.il',          # HTTP fallback (not recommended for production)
    '*'                                 # Allow all origins (remove in production for security)
]

# Game settings
DEFAULT_SLIDE_TIME = 30  # seconds per slide
MIN_USERS = 1
MAX_USERS = 100
USER_FLUCTUATION_RANGE = 3  # +/- users per update

# File paths
DATA_DIR = BASE_DIR / 'data'
LOG_DIR = BASE_DIR / 'logs'
GAME_DATA_FILE = DATA_DIR / 'game_data.json'
LOG_FILE = LOG_DIR / 'kahoot.log'

# Server settings
DEBUG = True  # Set to False in production
HOST = '0.0.0.0'
PORT = 5000

# Timezone
TIMEZONE = 'Asia/Jerusalem'

# Logging configuration
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Create directories
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Environment-specific settings
def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    
    if env == 'production':
        return ProductionConfig()
    elif env == 'testing':
        return TestingConfig()
    else:
        return DevelopmentConfig()

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'kahoot-quiz-server-secret-key')
    DEBUG = DEBUG
    ALLOWED_ORIGINS = ALLOWED_ORIGINS
    
class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    
class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    # Remove '*' from allowed origins for security
    ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin != '*']
    
class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True

