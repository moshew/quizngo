# HTTPS Setup for Office.com Compatibility

This add-in now supports HTTPS to enable sideloading on office.com and Office 365 online platforms.

## What was configured:

### 1. Installed Development Tools
```bash
npm install --save-dev office-addin-debugging office-addin-dev-certs
```

### 2. Created Development Certificates
```bash
npx office-addin-dev-certs install
```
This installed:
- Root certificate on your system
- SSL certificates for localhost
- Certificate location: `C:\Users\[USERNAME]\.office-addin-dev-certs\`

### 3. Created HTTPS Server (`server.js`)
- Uses Express.js with HTTPS
- Configured CORS for Office domains
- Serves static files from add-in directory
- Uses certificates from `.office-addin-dev-certs`

### 4. Updated Package.json Scripts
- `npm start` - Starts HTTPS server (default)
- `npm run start-https` - Explicitly starts HTTPS server
- `npm run start-http` - Falls back to HTTP server if needed
- `npm run certs:install` - Reinstalls certificates
- `npm run certs:verify` - Verifies certificate installation

### 5. Updated Manifest URLs
All URLs in `manifest.xml` now use `https://localhost:3000`

## Usage:

### For office.com sideloading:
1. Start the HTTPS server:
   ```bash
   npm start
   ```

2. Navigate to https://localhost:3000 and verify the certificate is trusted

3. Upload manifest.xml to office.com

### For local Office applications:
Both HTTP and HTTPS will work, but HTTPS is recommended for consistency.

## Troubleshooting:

### Certificate Issues:
```bash
# Reinstall certificates
npm run certs:install

# Verify installation
npm run certs:verify
```

### Port Already in Use:
```bash
# Kill any process using port 3000
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F
```

### Browser Certificate Warnings:
1. Navigate to https://localhost:3000
2. Click "Advanced" → "Proceed to localhost (unsafe)"
3. The certificate should then be trusted for the add-in

## Certificate Details:
- **Certificate Path**: `C:\Users\[USERNAME]\.office-addin-dev-certs\localhost.crt`
- **Private Key Path**: `C:\Users\[USERNAME]\.office-addin-dev-certs\localhost.key`
- **Valid For**: localhost, 127.0.0.1
- **Trusted By**: Windows Certificate Store (after installation)
