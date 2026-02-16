/**
 * Game Management Shapes Module
 * Handles Game ID and QR Code elements in PowerPoint slides
 */

/* global PowerPoint, Office */

import { getApiBase } from '../core/api.js';
import { showError } from '../ui/manager.js';

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
                showError('✅ מזהה משחק נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding game ID:', error);
        showError('שגיאה בהוספת מזהה משחק');
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
        const qrCodeUrl = `${getApiBase()}qr-code-player/${cleanPin}`;
        
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
                            
                            // Convert to base64 (WITHOUT the data URL prefix for Office API)
                            const base64Image = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    let result = reader.result;
                                    // Remove the data URL prefix (e.g., "data:image/png;base64,")
                                    if (result.includes(',')) {
                                        result = result.split(',')[1];
                                    }
                                    resolve(result);
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(imageBlob);
                            });
                            
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
 * Insert QR Code placeholder
 */
export async function insertQrCodeButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError('אנא בחר שקף תחילה');
                return;
            }
            
            const slide = slides.items[0];
            
            // QR code dimensions - standard size
            const qrSize = 200; // 200x200 points
            const qrLeft = 500; // Right side of slide
            const qrTop = 100;  // Top area
            
            // Create a placeholder shape with QR code tag
            const placeholder = slide.shapes.addTextBox('📱 QR Code\n\nיתעדכן בזמן המשחק', {
                left: qrLeft,
                top: qrTop,
                width: qrSize,
                height: qrSize
            });
            
            placeholder.load(['textFrame', 'tags']);
            await context.sync();
            
            // Add tag for dynamic updates
            placeholder.tags.add('quizngo-qr-code', 'true');
            await context.sync();
            
            // Style the text
            const textRange = placeholder.textFrame.textRange;
            textRange.load(['font']);
            await context.sync();
            
            textRange.font.size = 20;
            textRange.font.color = '#9b59b6';
            textRange.font.bold = true;
            
            await context.sync();
            
            // Try to style the placeholder (border and fill) - optional
            try {
                placeholder.load(['fill', 'line']);
                await context.sync();
                
                placeholder.fill.setSolidColor('#f0e6ff'); // Light purple background
                placeholder.line.color = '#9b59b6'; // Purple border
                placeholder.line.weight = 3;
                
                await context.sync();
                } catch (styleError) {
                // Border/fill styling is not critical - continue without it
            }
            
            showError('✅ QR Code נוסף לשקף!');
        });
    } catch (error) {
        console.error('Error adding QR code placeholder:', error);
        showError('שגיאה בהוספת QR Code');
    }
}
