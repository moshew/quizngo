/**
 * Game Management Shapes Module
 * Handles Game ID and QR Code elements in PowerPoint slides
 */

/* global PowerPoint, Office */

import { getApiUrl } from '../core/api.js';
import { showError } from '../ui/manager.js';
import { t } from '../i18n/index.js';

/**
 * Reset Game ID in all slides to placeholder
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function resetGameIdInSlides() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();

            // Batch 1: Load all shapes for all slides
            for (const slide of slides.items) {
                slide.shapes.load('items');
            }
            await context.sync();

            // Batch 2: Load all tags for all shapes
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    shape.tags.load('items/key, items/value');
                }
            }
            await context.sync();

            // Process: Find shapes with the tag and update them
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        for (const tag of shape.tags.items) {
                            if (tag.key.toLowerCase() === 'quizngo-game-id' && tag.value === 'true') {
                                try {
                                    shape.textFrame.textRange.text = '---';
                                } catch (e) { /* ignore shapes without textFrame */ }
                                break;
                            }
                        }
                    }
                }
            }

            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting game ID in slides:', error);
    }
}

/**
 * Update Game ID in all slides with the tag
 */
export async function updateGameIdInSlides(gamePin) {
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateGameIdInSlides');
        return;
    }
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasGameIdTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'quizngo-game-id' && tag.value === 'true') {
                            hasGameIdTag = true;
                            break;
                        }
                    }
                    
                    if (hasGameIdTag) {
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        try {
                            // Format PIN as XXX-XXX
                            const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
                            
                            const textRange = shape.textFrame.textRange;
                            textRange.text = formattedPin;
                            await context.sync();
                            
                            foundElements++;
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating game ID in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

/**
 * Insert Game ID button/textbox
 */
export async function insertGameIdButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default game ID
                const gameId = '123-456';
                
                // Add a text box with game ID and dynamic tag
                const textBox = slide.shapes.addTextBox(gameId, {
                    left: 100,
                    top: 50,
                    width: 300,
                    height: 80
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('quizngo-game-id', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 32;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                await context.sync();
            }
        });
    } catch (error) {
        console.error('Error adding game ID:', error);
    }
}

/**
 * Update QR Code in slides with image from server
 * Uses gamePin as the identifier (hashId is deprecated)
 */
export async function updateQrCodeInSlides(gamePin) {
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateQrCodeInSlides');
        return;
    }
    
    try {
        // Build QR code URL for PLAYERS (port 8080)
        // Remove any dashes from game PIN for URL
        const cleanPin = gamePin.replace(/-/g, '');
        const qrCodeUrl = getApiUrl(`qr-code-player/${cleanPin}`);
        
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // STEP 1: Collect all QR placeholders first (before any deletion)
            const qrPlaceholders = [];
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    const tags = shape.tags;
                    tags.load(['items']);
                    await context.sync();
                    
                    let hasQrCodeTag = false;
                    for (let k = 0; k < tags.items.length; k++) {
                        const tag = tags.items[k];
                        tag.load(['key', 'value']);
                        await context.sync();
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'quizngo-qr-code' && tag.value === 'true') {
                            hasQrCodeTag = true;
                            break;
                        }
                    }
                    
                    if (hasQrCodeTag) {
                        // Load placeholder properties and save for later
                        shape.load(['left', 'top', 'width', 'height', 'name']);
                        await context.sync();
                        
                        qrPlaceholders.push({
                            shape: shape,
                            slideIndex: i + 1,
                            left: shape.left,
                            top: shape.top,
                            width: shape.width,
                            height: shape.height
                        });
                    }
                }
            }
            
            // STEP 2: Now update all placeholders (after collecting them all)
            let foundElements = 0;
            
            for (const placeholder of qrPlaceholders) {
                const { shape, slideIndex, left, top, width, height } = placeholder;
                
                try {
                    // Format game PIN for display
                    const formattedPin = gamePin.includes('-') ? gamePin : `${gamePin.slice(0, 3)}-${gamePin.slice(3)}`;
                            
                            // Download QR code image FIRST (before any deletion)
                            const imageResponse = await fetch(qrCodeUrl);
                            
                            if (!imageResponse.ok) {
                                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                            }
                            
                            const imageBlob = await imageResponse.blob();
                            
                            // Read blob → data URL, then trim quiet zone + recolor to black
                            const dataUrl = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(imageBlob);
                            });
                            const base64Image = await processQrToBlack(dataUrl);
                            
                            // Delete the placeholder shape
                            shape.delete();
                            await context.sync();
                            
                            // Insert new QR image at the same position
                            // NOTE: This will insert into slide 1 (current limitation of PowerPoint Desktop API)
                            await new Promise((resolve, reject) => {
                                Office.context.document.setSelectedDataAsync(
                                    base64Image,
                                    {
                                        coercionType: Office.CoercionType.Image,
                                        imageLeft: left,
                                        imageTop: top,
                                        imageWidth: width,
                                        imageHeight: height
                                    },
                                    function(asyncResult) {
                                        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                                            resolve();
                                        } else {
                                            console.error('❌ Image insertion failed:', asyncResult.error.message);
                                            reject(new Error(asyncResult.error.message));
                                        }
                                    }
                                );
                            });
                            
                            // Now find the newly inserted image and tag it as the NEW placeholder
                            await context.sync();
                            
                            // IMPORTANT: Refresh the slide shapes to get the newly inserted image
                            // The image is always inserted in slide 1 (PowerPoint Desktop limitation)
                            const firstSlide = slides.items[0];
                            const shapesAfter = firstSlide.shapes;
                            shapesAfter.load(['items']);
                            await context.sync();
                            
                            // Find the MOST RECENTLY ADDED image at the expected position
                            // We search backwards (from the end) to find the newest shape
                            let imageTagged = false;
                            for (let m = shapesAfter.items.length - 1; m >= 0; m--) {
                                const potentialImage = shapesAfter.items[m];
                                potentialImage.load(['type', 'left', 'top', 'tags']);
                                await context.sync();
                                
                                // Check if it's at the same position as our old placeholder
                                // AND doesn't already have the quizngo-qr-code tag (to avoid retagging)
                                if (Math.abs(potentialImage.left - left) < 1 && 
                                    Math.abs(potentialImage.top - top) < 1) {
                                    
                                    // Check if already tagged (to avoid duplicates)
                                    const existingTags = potentialImage.tags;
                                    existingTags.load(['items']);
                                    await context.sync();
                                    
                                    let alreadyTagged = false;
                                    for (let t = 0; t < existingTags.items.length; t++) {
                                        const existingTag = existingTags.items[t];
                                        existingTag.load(['key', 'value']);
                                        await context.sync();
                                        
                                        if (existingTag.key.toLowerCase() === 'quizngo-qr-code' && existingTag.value === 'true') {
                                            alreadyTagged = true;
                                            break;
                                        }
                                    }
                                    
                                    if (!alreadyTagged) {
                                        // Tag it as the QR code placeholder for next update
                                        potentialImage.tags.add('quizngo-qr-code', 'true');
                                        potentialImage.tags.add('quizngo-qr-url', qrCodeUrl);
                                        potentialImage.tags.add('quizngo-qr-gamepin', gamePin);
                                        await context.sync();
                                        imageTagged = true;
                                        break;
                                    }
                                }
                            }
                            
                            foundElements++;
                            
                        } catch (updateError) {
                            console.error(`❌ Error updating QR code in slide ${slideIndex}:`, updateError);
                        }
            }
        });
    } catch (error) {
        console.error('❌ Error updating QR code in slides:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

/**
 * Generate a QR code PNG base64 string (without data: prefix) for the given text.
 * Requires vendor/qrcode.min.js (qrcode-generator by Kazuhiko Arase) to be loaded globally.
 */
function generateQrBase64(text, sizePixels = 200) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quietZone = 4; // standard 4-module quiet zone, matches server-generated QR appearance
    const totalModules = moduleCount + quietZone * 2;
    const cellSize = Math.floor(sizePixels / totalModules);
    const canvasSize = cellSize * totalModules;
    const offset = quietZone * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.fillStyle = '#000000';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
            }
        }
    }

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
}

/**
 * Recolor all QR modules to black; quiet zone and white background are preserved unchanged.
 * @param {string} dataUrl - full data URL of the source image
 * @returns {Promise<string>} base64 PNG without data URL prefix
 */
function processQrToBlack(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.width, h = img.height;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);
            const pd = ctx.getImageData(0, 0, w, h);
            const px = pd.data;
            const T = 200;
            for (let i = 0; i < px.length; i += 4) {
                if (px[i] > T && px[i+1] > T && px[i+2] > T) {
                    px[i] = px[i+1] = px[i+2] = 255; px[i+3] = 255;
                } else {
                    px[i] = px[i+1] = px[i+2] = 0;   px[i+3] = 255;
                }
            }
            ctx.putImageData(pd, 0, 0);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.src = dataUrl;
    });
}

/**
 * Insert QR Code placeholder — inserts an actual QR code image encoding "Preview".
 * Tagged with quizngo-qr-code so updateQrCodeInSlides() can replace it with the live URL.
 */
export async function insertQrCodeButton() {
    try {
        // QR code dimensions — includes quiet zone, matches server-generated QR appearance
        const qrSize = 144; // points (includes ~4-module quiet zone border)
        const qrLeft = 500;
        const qrTop  = 100;

        // Render at 2x for sharpness
        const base64Png = generateQrBase64('Preview', 288);

        await new Promise((resolve, reject) => {
            Office.context.document.setSelectedDataAsync(
                base64Png,
                {
                    coercionType: Office.CoercionType.Image,
                    imageLeft:  qrLeft,
                    imageTop:   qrTop,
                    imageWidth: qrSize,
                    imageHeight: qrSize,
                },
                (asyncResult) => {
                    if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
                        resolve();
                    } else {
                        reject(new Error(asyncResult.error.message));
                    }
                }
            );
        });

        // Tag the newly inserted image so updateQrCodeInSlides() can find and replace it
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();

            if (slides.items.length === 0) return;

            const slide = slides.items[0];
            slide.shapes.load('items');
            await context.sync();

            // The newly inserted image is always the last shape
            const shapes = slide.shapes.items;
            if (shapes.length === 0) return;

            const newShape = shapes[shapes.length - 1];
            newShape.tags.add('quizngo-qr-code', 'true');
            await context.sync();
        });

    } catch (error) {
        console.error('Error adding QR code placeholder:', error);
        showError(t('errors.addQrCode'));
    }
}
