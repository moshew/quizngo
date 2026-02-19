/**
 * Question Timer Shapes Module
 * Handles question time and respondents count elements in PowerPoint slides
 */

/* global PowerPoint */

import { showError } from '../ui/manager.js';
import { t } from '../i18n/index.js';

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
                console.log('âœ… Question time added to slide');
                showError(t('success.questionTimeAdded'));
            }
        });
    } catch (error) {
        console.error('Error adding question time:', error);
        showError(t('errors.addQuestionTime'));
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
                console.log('âœ… Respondents count added to slide');
                showError(t('success.respondersCountAdded'));
            }
        });
    } catch (error) {
        console.error('Error adding respondents count:', error);
        showError(t('errors.addRespondersCount'));
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
        console.error('âŒ Error resetting question time elements:', error);
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
        console.error('âŒ Error resetting respondents count elements:', error);
        throw error;
    }
}

/**
 * Backward-compatible wrapper.
 * Game runtime updates all quizngo-question-time instances across all slides.
 */
export async function updateCurrentSlideQuestionTime(timeValue, _slideNumber = null) {
    // Keep API for backward compatibility, but update all tagged instances.
    return updateAllQuestionTimeElements(timeValue);
}

/**
 * Backward-compatible wrapper.
 * Game runtime updates all quizngo-respondents-count instances across all slides.
 */
export async function updateCurrentSlideRespondentsCount(count, _slideNumber = null) {
    // Keep API for backward compatibility, but update all tagged instances.
    return updateAllRespondentsCountElements(count);
}
