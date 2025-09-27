const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Office Add-ins
app.use(cors({
    origin: ['https://www.office.com', 'https://office.com', 'https://outlook.office.com', 'https://outlook.office365.com'],
    credentials: true
}));

// Serve static files from current directory
app.use(express.static(__dirname));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'taskpane.html'));
});

// Certificate paths
const certDir = path.join(require('os').homedir(), '.office-addin-dev-certs');
const options = {
    key: fs.readFileSync(path.join(certDir, 'localhost.key')),
    cert: fs.readFileSync(path.join(certDir, 'localhost.crt'))
};

// Create HTTPS server
const server = https.createServer(options, app);

server.listen(PORT, () => {
    console.log(`🚀 HTTPS Server running on https://localhost:${PORT}`);
    console.log(`📋 Manifest URL: https://localhost:${PORT}/manifest.xml`);
    console.log(`🔒 Using certificates from: ${certDir}`);
});

// Handle server errors
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use. Please try a different port.`);
    } else {
        console.error('❌ Server error:', err);
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server closed.');
        process.exit(0);
    });
});
