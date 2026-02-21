/**
 * QuizNGO Add-in Configuration
 *
 * Remote-only setup:
 * - taskpane is loaded from https://quizngo.online/addin
 * - LB endpoint is https://srv.quizngo.online
 * - no localhost fallback
 */

// Load Balancer URL - for PIN resolution and server assignment.
window.QUIZNGO_LB_URL = 'https://srv.quizngo.online/';

// Admin client URL - where admins monitor the game.
window.QUIZNGO_ADMIN_HOST = 'https://admin.quizngo.online';

// Game client URL - where players join (for QR code generation).
window.QUIZNGO_GAME_HOST = 'https://game.quizngo.online';
