/**
 * Question Timer Shapes Module
 * Handles question time and respondents count elements in PowerPoint slides
 */

/* global PowerPoint */

import { showError } from '../ui/manager.js';

/**
 * Add Question Time textbox
 */
export async function addQuestionTime() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default time value
                const textBox = slide.shapes.addTextBox('30', {
                    left: 600,
                    top: 50,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('quizngo-question-time', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#667eea';
                textRange.font.bold = true;
                
                // Set alignment - use try/catch in case alignment is not supported
                try {
                    textRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.Center;
                } catch (alignError) {
                    console.log('Could not set text alignment:', alignError);
                }
                
                await context.sync();
                console.log('✅ Question time added to slide');
                showError('✅ זמן שאלה נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding question time:', error);
        showError('שגיאה בהוספת זמן שאלה');
    }
}

/**
 * Add Respondents Count textbox
 */
export async function addRespondentsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Add a text box with default respondents value
                const textBox = slide.shapes.addTextBox('99', {
                    left: 600,
                    top: 130,
                    width: 100,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for identification
                textBox.tags.add('quizngo-respondents-count', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                textRange.font.size = 36;
                textRange.font.color = '#f5576c';
                textRange.font.bold = true;
                
                // Set alignment - use try/catch in case alignment is not supported
                try {
                    textRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.Center;
                } catch (alignError) {
                    console.log('Could not set text alignment:', alignError);
                }
                
                await context.sync();
                console.log('✅ Respondents count added to slide');
                showError('✅ מספר עונים נוסף לשקף!');
            }
        });
    } catch (error) {
        console.error('Error adding respondents count:', error);
        showError('שגיאה בהוספת מספר עונים');
    }
}

/**
 * Update all quizngo-question-time elements to initial value (ALL slides)
 * Used for initialization/reset
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 * @param {number} timeValue - Initial time value to set
 */
export async function updateAllQuestionTimeElements(timeValue) {
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
            
            // Process: Find shapes with the tag and update them (no sync needed)
            const shapesToUpdate = [];
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        for (const tag of shape.tags.items) {
                            if (tag.key.toLowerCase() === 'quizngo-question-time' && tag.value === 'true') {
                                shapesToUpdate.push(shape);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Update all shapes at once
            for (const shape of shapesToUpdate) {
                try {
                    shape.textFrame.textRange.text = timeValue.toString();
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            
            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting question time elements:', error);
        throw error;
    }
}

/**
 * Update ALL quizngo-respondents-count elements across all slides
 * Similar to updateAllQuestionTimeElements but for respondents count
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 * @param {number} count - Number of respondents who answered
 */
export async function updateAllRespondentsCountElements(count) {
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
            
            // Process: Find shapes with the tag and update them (no sync needed)
            const shapesToUpdate = [];
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        for (const tag of shape.tags.items) {
                            if (tag.key.toLowerCase() === 'quizngo-respondents-count' && tag.value === 'true') {
                                shapesToUpdate.push(shape);
                                break;
                            }
                        }
                    }
                }
            }
            
            // Update all shapes at once
            for (const shape of shapesToUpdate) {
                try {
                    shape.textFrame.textRange.text = count.toString();
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            
            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting respondents count elements:', error);
        throw error;
    }
}

/**
 * Update quizngo-question-time in CURRENT slide only
 * Used during timer countdown
 * @param {number} timeValue - Time value to display
 * @param {number} [slideNumber] - Optional: specific slide number to update (1-based). If not provided, uses selected slide.
 */
export async function updateCurrentSlideQuestionTime(timeValue, slideNumber = null) {
    try {
        await PowerPoint.run(async (context) => {
            let currentSlide;
            
            if (slideNumber !== null) {
                // Use specific slide number (for presentation mode)
                const presentation = context.presentation;
                const slides = presentation.slides;
                slides.load('items');
                await context.sync();
                
                const slideIndex = slideNumber - 1; // Convert to 0-based index
                if (slideIndex >= 0 && slideIndex < slides.items.length) {
                    currentSlide = slides.items[slideIndex];
                } else {
                    console.error(`❌ Invalid slide number: ${slideNumber}`);
                    return;
                }
            } else {
                // Use selected slide (for edit mode)
                const slides = context.presentation.getSelectedSlides();
                slides.load('items');
                await context.sync();
                
                if (slides.items.length === 0) {
                    console.log('⚠️ No slide selected');
                    return;
                }
                
                currentSlide = slides.items[0];
            }
            
            const shapes = currentSlide.shapes;
            shapes.load(['items']);
            await context.sync();
            
            let updatedCount = 0;
            
            // Search only current slide for quizngo-question-time tags
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                // Check if this shape has quizngo-question-time tag
                let hasQuestionTimeTag = false;
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key.toLowerCase() === 'quizngo-question-time' && tag.value === 'true') {
                        hasQuestionTimeTag = true;
                        break;
                    }
                }
                
                if (hasQuestionTimeTag) {
                    // Update the text
                    shape.load(['textFrame']);
                    await context.sync();
                    
                    const textRange = shape.textFrame.textRange;
                    textRange.text = timeValue.toString();
                    await context.sync();
                    
                    updatedCount++;
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating current slide timer:', error);
        throw error;
    }
}

/**
 * Update "מספר עונים" (respondents count) in current slide
 * Similar to updateCurrentSlideQuestionTime but for quizngo-respondents-count tag
 * @param {number} count - Number of respondents who answered
 * @param {number} slideNumber - Optional slide number (for presentation mode)
 */
export async function updateCurrentSlideRespondentsCount(count, slideNumber = null) {
    try {
        await PowerPoint.run(async (context) => {
            let currentSlide;
            
            if (slideNumber !== null) {
                // Use specific slide number (for presentation mode)
                const presentation = context.presentation;
                const slides = presentation.slides;
                slides.load('items');
                await context.sync();
                
                const slideIndex = slideNumber - 1; // Convert to 0-based index
                if (slideIndex >= 0 && slideIndex < slides.items.length) {
                    currentSlide = slides.items[slideIndex];
                } else {
                    console.error(`❌ Invalid slide number: ${slideNumber}`);
                    return;
                }
            } else {
                // Use selected slide (for edit mode)
                const slides = context.presentation.getSelectedSlides();
                slides.load('items');
                await context.sync();
                
                if (slides.items.length === 0) {
                    console.log('⚠️ No slide selected');
                    return;
                }
                
                currentSlide = slides.items[0];
            }
            
            const shapes = currentSlide.shapes;
            shapes.load(['items']);
            await context.sync();
            
            let updatedCount = 0;
            
            // Search only current slide for quizngo-respondents-count tags
            for (let j = 0; j < shapes.items.length; j++) {
                const shape = shapes.items[j];
                const tags = shape.tags;
                tags.load(['items']);
                await context.sync();
                
                // Check if this shape has quizngo-respondents-count tag
                let hasRespondentsTag = false;
                for (let k = 0; k < tags.items.length; k++) {
                    const tag = tags.items[k];
                    tag.load(['key', 'value']);
                    await context.sync();
                    
                    if (tag.key.toLowerCase() === 'quizngo-respondents-count' && tag.value === 'true') {
                        hasRespondentsTag = true;
                        break;
                    }
                }
                
                if (hasRespondentsTag) {
                    // Update the text
                    shape.load(['textFrame']);
                    await context.sync();
                    
                    const textRange = shape.textFrame.textRange;
                    textRange.text = count.toString();
                    await context.sync();
                    
                    updatedCount++;
                    console.log(`✅ Updated respondents count to ${count} in current slide`);
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating respondents count:', error);
        throw error;
    }
}
