"""
Info routes for Kahoot Quiz Server.
Handles game info, QR codes, documentation, status, and widgets.
"""

import re
import json
from io import BytesIO
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory, send_file
import qrcode


def create_info_routes(game):
    """
    Create info routes blueprint.
    
    Args:
        game: GameManager instance
    
    Returns:
        Blueprint with info routes
    """
    info_bp = Blueprint('info', __name__)

    @info_bp.route('/debug_save_location.html')
    def debug_save_location():
        """Serve the save location debug page"""
        return send_from_directory('.', 'debug_save_location.html')

    @info_bp.route('/game-info/<hash_id>', methods=['GET'])
    def get_game_info(hash_id):
        """Get game information including QR code for a specific game hash."""
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
            hash_id = re.sub(r'[^a-zA-Z0-9]', '', hash_id)
            
            if len(hash_id) < 8 or len(hash_id) > 20:
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid hash ID length'
                }), 400
            
            # Build admin URL (for QR code in "Start Game" button)
            admin_url = f'http://192.168.31.22:3002/{hash_id}'
            
            game.log(f'✅ Generated game info for hash: {hash_id}')
            game.log(f'   Admin URL: {admin_url}')
            
            return jsonify({
                'status': 'success',
                'hashId': hash_id,
                'adminUrl': admin_url,
                'qrCodeUrl': f'/qr-code/{hash_id}'
            })
            
        except Exception as e:
            game.log(f'❌ Error generating game info: {str(e)}')
            return jsonify({
                'status': 'error',
                'message': f'Error: {str(e)}'
            }), 500

    @info_bp.route('/qr-code/<hash_id>', methods=['GET'])
    def get_qr_code(hash_id):
        """Generate and return QR code image for admin (uses hash_id)."""
        try:
            # Validate and sanitize hash ID
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

    @info_bp.route('/qr-code-player/<game_pin>', methods=['GET'])
    def get_qr_code_player(game_pin):
        """Generate and return QR code image for players (uses game_pin)."""
        try:
            # Validate and sanitize game PIN
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

    @info_bp.route('/participants_widget')
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

    @info_bp.route('/docs')
    def docs():
        """API documentation page"""
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
                הפעל עם: <code>python server.py</code><br>
                השרת רץ על: <code>http://localhost:5000</code>
            </div>
            
            <div class="status">
                <strong>סטטוס שרת:</strong> פעיל<br>
                <strong>גרסה:</strong> 1.0.0 (Python)<br>
                <strong>זמן שרת:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            </div>
            
            <h2>נקודות קצה זמינות (Endpoints)</h2>
            
            <div class="note" style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
                <h4 style="margin-top: 0;">📌 הערה חשובה - מבנה המערכת</h4>
                <p><strong>מזהה משחק (Hash ID):</strong> מזהה ייחודי המחושב מנתיב קובץ המצגת (12 תווים הקסדצימליים)</p>
                <p><strong>קוד משחק (Game PIN):</strong> קוד בן 6 ספרות שמשתתפים משתמשים בו כדי להצטרף למשחק</p>
                <p><strong>מזהה משתתף (UID):</strong> מזהה ייחודי שהשרת מייצר לכל משתתף בעת ההצטרפות</p>
            </div>
            
            <h3>🎮 ניהול משחק</h3>
            
            <div class="endpoint">
                <h3>🎯 רישום סשן משחק</h3>
                <div class="url">GET /?register_session&amp;hash_id=HASH&amp;game_pin=PIN</div>
                <p>רושם סשן משחק חדש עם hash_id (מזהה מצגת) ו-game_pin (קוד כניסה למשחק)</p>
            </div>
            
            <div class="endpoint">
                <h3>🔍 בדיקת קיום משחק פעיל</h3>
                <div class="url">GET /?check_active_game&amp;hash_id=HASH</div>
                <p>בודק אם קיים משחק פעיל עבור ה-hash_id הנתון</p>
            </div>
            
            <div class="endpoint">
                <h3>🔒 סגירת משחק</h3>
                <div class="url">GET /?close_game&amp;hash_id=HASH</div>
                <p>סוגר משחק פעיל (מסמן אותו כ-inactive)</p>
            </div>
            
            <h3>👥 ניהול משתתפים</h3>
            
            <div class="endpoint">
                <h3>🚪 התחל קבלת משתתפים</h3>
                <div class="url">GET /?start_accepting_participants&amp;hash_id=HASH</div>
            </div>
            
            <div class="endpoint">
                <h3>🚫 הפסק קבלת משתתפים</h3>
                <div class="url">GET /?stop_accepting_participants&amp;hash_id=HASH</div>
            </div>
            
            <div class="endpoint">
                <h3>➕ הצטרפות משתתף</h3>
                <div class="url">POST /?join_player</div>
                <p><strong>JSON Body:</strong> <code>{{"game_pin": "123456", "name": "שם"}}</code></p>
            </div>
            
            <h3>🧭 ניווט ובקרה</h3>
            
            <div class="endpoint">
                <h3>➡️ מעבר לשקף הבא</h3>
                <div class="url">GET /?next_slide&amp;hash_id=HASH</div>
            </div>
            
            <hr>
            <p><small>Kahoot Quiz Server API v1.0 (Python) - תוכנן לעבודה עם PowerPoint Add-in</small></p>
        </body>
        </html>
        """
        return html

    return info_bp
