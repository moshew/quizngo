/**
 * Game Management Shapes Module
 * Handles Game ID and QR Code elements in PowerPoint slides
 */

/* global PowerPoint, Office */

import { API_BASE } from '../core/api.js';
import { showError } from '../ui/manager.js';

/**
 * Update Game ID in all slides with the tag
 */
export async function updateGameIdInSlides(gamePin) {
    console.log(`🎮 Starting updateGameIdInSlides with PIN: ${gamePin}`);
    
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
            
            console.log(`🔍 Searching for kahoot-game-id tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
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
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-game-id' && tag.value === 'true') {
                            hasGameIdTag = true;
                            console.log('  ✅ Found kahoot-game-id tag!');
                            break;
                        }
                    }
                    
                    if (hasGameIdTag) {
                        console.log(`📝 Updating shape in slide ${i + 1}`);
                        shape.load(['textFrame', 'name', 'type']);
                        await context.sync();
                        
                        console.log(`  Shape type: ${shape.type}, name: ${shape.name}`);
                        
                        try {
                            // Format PIN as XXX-XXX
                            const formattedPin = gamePin.slice(0, 3) + '-' + gamePin.slice(3);
                            
                            const textRange = shape.textFrame.textRange;
                            textRange.text = formattedPin;
                            await context.sync();
                            
                            foundElements++;
                            console.log(`✅ Updated game PIN to: ${formattedPin} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
            }
            
            console.log(`✅ Total game ID elements updated: ${foundElements}`);
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
                textBox.tags.add('kahoot-game-id', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 32;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic game ID added to slide');
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
 */
export async function updateQrCodeInSlides(hashId, gamePin) {
    console.log(`📱 Starting updateQrCodeInSlides with hash ID: ${hashId}, game PIN: ${gamePin}`);
    
    if (!gamePin) {
        console.error('❌ No game PIN provided to updateQrCodeInSlides');
        return;
    }
    
    try {
        // Build QR code URL for PLAYERS (port 8080)
        // Remove any dashes from game PIN for URL
        const cleanPin = gamePin.replace(/-/g, '');
        const qrCodeUrl = `${API_BASE}qr-code-player/${cleanPin}`;
        console.log('📸 Player QR Code URL:', qrCodeUrl);
        
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for kahoot-qr-code tags in ${slides.items.length} slides...`);
            
            // STEP 1: Collect all QR placeholders first (before any deletion)
            const qrPlaceholders = [];
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                shapes.load(['items']);
                await context.sync();
                
                console.log(`📄 Checking slide ${i + 1} with ${shapes.items.length} shapes`);
                
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
                        
                        console.log(`  🏷️ Tag: ${tag.key} = ${tag.value}`);
                        
                        // Case-insensitive comparison
                        if (tag.key.toLowerCase() === 'kahoot-qr-code' && tag.value === 'true') {
                            hasQrCodeTag = true;
                            console.log('  ✅ Found kahoot-qr-code tag!');
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
                        
                        console.log(`📝 Queued QR placeholder in slide ${i + 1} at (${shape.left}, ${shape.top})`);
                    }
                }
            }
            
            console.log(`\n📋 Found ${qrPlaceholders.length} QR placeholder(s) to update\n`);
            
            // STEP 2: Now update all placeholders (after collecting them all)
            let foundElements = 0;
            
            for (const placeholder of qrPlaceholders) {
                const { shape, slideIndex, left, top, width, height } = placeholder;
                
                console.log(`\n📝 Updating QR code ${foundElements + 1}/${qrPlaceholders.length} from slide ${slideIndex}`);
                
                try {
                    // Format game PIN for display
                    const formattedPin = gamePin.includes('-') ? gamePin : `${gamePin.slice(0, 3)}-${gamePin.slice(3)}`;
                    
                    console.log(`   Placeholder position: ${left}, ${top}, Size: ${width}x${height}`);
                            
                            // Download QR code image FIRST (before any deletion)
                            console.log('📥 Downloading QR code image from:', qrCodeUrl);
                            const imageResponse = await fetch(qrCodeUrl);
                            
                            if (!imageResponse.ok) {
                                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                            }
                            
                            const imageBlob = await imageResponse.blob();
                            console.log(`📦 Image size: ${imageBlob.size} bytes`);
                            
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
                            
                            console.log('✅ QR image downloaded and ready');
                            console.log('📸 Base64 image length:', base64Image.length);
                            
                            // Delete the placeholder shape
                            console.log('🗑️ Deleting placeholder shape...');
                            shape.delete();
                            await context.sync();
                            console.log('✅ Placeholder deleted');
                            
                            // Insert new QR image at the same position
                            // NOTE: This will insert into slide 1 (current limitation of PowerPoint Desktop API)
                            console.log('🖼️ Inserting new QR image...');
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
                                            console.log('✅ Image inserted successfully');
                                            resolve();
                                        } else {
                                            console.error('❌ Image insertion failed:', asyncResult.error.message);
                                            reject(new Error(asyncResult.error.message));
                                        }
                                    }
                                );
                            });
                            
                            // Now find the newly inserted image and tag it as the NEW placeholder
                            console.log('🔍 Looking for the newly inserted image to tag it...');
                            await context.sync();
                            
                            // IMPORTANT: Refresh the slide shapes to get the newly inserted image
                            // The image is always inserted in slide 1 (PowerPoint Desktop limitation)
                            const firstSlide = slides.items[0];
                            const shapesAfter = firstSlide.shapes;
                            shapesAfter.load(['items']);
                            await context.sync();
                            
                            console.log(`   Total shapes in slide 1 after insertion: ${shapesAfter.items.length}`);
                            
                            // Find the MOST RECENTLY ADDED image at the expected position
                            // We search backwards (from the end) to find the newest shape
                            let imageTagged = false;
                            for (let m = shapesAfter.items.length - 1; m >= 0; m--) {
                                const potentialImage = shapesAfter.items[m];
                                potentialImage.load(['type', 'left', 'top', 'tags']);
                                await context.sync();
                                
                                console.log(`   Checking shape ${m}: type=${potentialImage.type}, pos=${potentialImage.left},${potentialImage.top}`);
                                
                                // Check if it's at the same position as our old placeholder
                                // AND doesn't already have the kahoot-qr-code tag (to avoid retagging)
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
                                        
                                        if (existingTag.key.toLowerCase() === 'kahoot-qr-code' && existingTag.value === 'true') {
                                            alreadyTagged = true;
                                            console.log(`   Shape ${m} already has kahoot-qr-code tag, skipping...`);
                                            break;
                                        }
                                    }
                                    
                                    if (!alreadyTagged) {
                                        // Tag it as the QR code placeholder for next update
                                        console.log(`🏷️ Tagging new QR image (shape ${m}) as placeholder...`);
                                        potentialImage.tags.add('kahoot-qr-code', 'true');
                                        potentialImage.tags.add('kahoot-qr-url', qrCodeUrl);
                                        potentialImage.tags.add('kahoot-qr-gamepin', gamePin);
                                        await context.sync();
                                        console.log('✅ QR image tagged as new placeholder');
                                        imageTagged = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!imageTagged) {
                                console.warn(`⚠️ Could not find and tag the new QR image - it may not update next time`);
                            }
                            
                            foundElements++;
                            console.log(`✅ QR Code replaced placeholder in slide ${slideIndex}`);
                            console.log(`   Game PIN: ${formattedPin}`);
                            console.log(`   💡 QR image is now the placeholder for next update`);
                            
                        } catch (updateError) {
                            console.error(`❌ Error updating QR code in slide ${slideIndex}:`, updateError);
                            console.error('   Details:', updateError.message);
                        }
            }
            
            console.log(`✅ Total QR Code elements updated: ${foundElements}`);
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
            placeholder.tags.add('kahoot-qr-code', 'true');
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
                console.log('✅ Border and fill applied');
            } catch (styleError) {
                console.log('⚠️ Could not apply border/fill (not critical):', styleError.message);
            }
            
            console.log('✅ QR Code placeholder added to slide');
            console.log(`   Position: ${qrLeft}, ${qrTop}`);
            console.log(`   Size: ${qrSize} x ${qrSize}`);
            showError('✅ QR Code נוסף לשקף!');
        });
    } catch (error) {
        console.error('Error adding QR code placeholder:', error);
        showError('שגיאה בהוספת QR Code');
    }
}
