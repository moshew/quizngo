/**
 * QuizNGO Add-in Configuration
 *
 * Copy this file to config.js and customize for your environment.
 * Then include it in manifest.xml before other scripts:
 * <bt:Url id="Taskpane.Url" DefaultValue="https://localhost:3000/taskpane.html" />
 * Add <script src="config.js"></script> in taskpane.html <head>
 */

// Load Balancer URL - for PIN resolution and server assignment
window.QUIZNGO_LB_URL = 'http://localhost:5000/';

// Admin client URL - where admins monitor the game
window.QUIZNGO_ADMIN_HOST = 'http://192.168.31.22:3002';

// Game client URL - where players join (for QR code generation)
window.QUIZNGO_GAME_HOST = 'http://192.168.31.22:8080';

/**
 * Examples:
 *
 * Local development:
 *   window.QUIZNGO_LB_URL = 'http://localhost:5000/';
 *   window.QUIZNGO_ADMIN_HOST = 'http://localhost:3002';
 *   window.QUIZNGO_GAME_HOST = 'http://localhost:8080';
 *
 * Production with load balancer:
 *   window.QUIZNGO_LB_URL = 'https://quizngo-lb.example.com/';
 *   window.QUIZNGO_ADMIN_HOST = 'https://quizngo-admin.example.com';
 *   window.QUIZNGO_GAME_HOST = 'https://quizngo-game.example.com';
 *
 * LAN deployment:
 *   window.QUIZNGO_LB_URL = 'http://192.168.1.100:5000/';
 *   window.QUIZNGO_ADMIN_HOST = 'http://192.168.1.100:3002';
 *   window.QUIZNGO_GAME_HOST = 'http://192.168.1.100:8080';
 */
