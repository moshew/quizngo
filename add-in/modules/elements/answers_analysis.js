/**
 * Answers Analysis Shapes Module
 * Handles answer distribution charts and leaderboard elements in PowerPoint slides
 */

/* global PowerPoint */

import { showError } from '../ui/manager.js';
import { t } from '../i18n/index.js';

/**
 * Add Answers Distribution Bar Chart
 * Creates a dynamic bar chart with 4 answer options using shapes and text
 */
export async function addAnswersDistribution() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError(t('errors.selectSlideFirst'));
                return;
            }
            
            const slide = slides.items[0];
            
            // Chart configuration
            const slideWidth = 960; // 16:9 Aspect Ratio
            const slideHeight = 540;
            
            // Chart dimensions - Narrower bars, wider spacing
            const barWidth = 50; // Narrower bars
            const barSpacing = 50; // Wider spacing
            const maxBarHeight = slideHeight * 0.50; // 50% of slide height (270)
            
            // Calculate total width to center properly
            const totalChartWidth = (barWidth * 4) + (barSpacing * 3);
            const chartLeft = (slideWidth - totalChartWidth) / 2;
            
            // Position: 15% from bottom (bottom at 85% of slide height)
            const chartBottom = slideHeight * 0.85; 
            const chartTop = chartBottom - maxBarHeight;
            
            // Answer data with default values (Red 8, Blue 12, Yellow 0, Green 2)
            const answers = [
                { number: 1, color: '#C00000', borderColor: '#8C0000', value: 8, label: '1' }, // Very Dark Red
                { number: 2, color: '#205285', borderColor: '#143255', value: 12, label: '2' }, // Very Dark Blue
                { number: 3, color: '#FFD966', borderColor: '#CCAE33', value: 0, label: '3' }, // Dark Goldenrod
                { number: 4, color: '#92D050', borderColor: '#649628', value: 2, label: '4' }  // Dark Green
            ];
            
            // Helper to get color by number
            const getColorByNumber = (num) => {
                const ans = answers.find(a => a.number === num);
                return ans ? ans.color : '#808080';
            };
            
            const getBorderColorByNumber = (num) => {
                const ans = answers.find(a => a.number === num);
                return ans ? ans.borderColor : '#000000';
            };
            
            // Find max value for initial scaling
            const maxValue = Math.max(...answers.map(a => a.value), 1);
            
            // Underline color (Dark Navy/Black)
            const underlineColor = '#0f243e';
            
            // Create bars and labels for each answer
            for (let i = 0; i < answers.length; i++) {
                const answer = answers[i];
                const barLeft = chartLeft + i * (barWidth + barSpacing);
                
                // Calculate initial height based on default values
                const calculatedHeight = (answer.value / maxValue) * maxBarHeight;
                // Minimum bar height of 5 to avoid PowerPoint errors
                const barHeight = answer.value === 0 ? 5 : Math.max(calculatedHeight, 5);
                
                // Round values to avoid potential precision issues (Safe values)
                const safeHeight = Math.round(barHeight * 10) / 10;
                const safeTop = Math.round((chartTop + (maxBarHeight - safeHeight)) * 10) / 10;
                
                // 1. Create bar (rectangle) - always create with minimum height
                const bar = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
                bar.left = barLeft;
                bar.top = safeTop;
                bar.width = barWidth;
                bar.height = safeHeight;
                
                // Load fill and tags first
                bar.load(['fill', 'tags', 'line']); // Load line as well
                await context.sync();
                
                // Note: We avoid setting bar.visible = false for 0 values as it can cause GeneralException
                // Instead we rely on the minimal height (5) and potentially hide the border
                
                // Style the bar fill
                bar.fill.setSolidColor(answer.color);
                
                // Set border properties - wrap in try/catch
                try {
                    if (bar.line) {
                        bar.line.visible = answer.value !== 0;
                        bar.line.color = answer.borderColor;
                        bar.line.weight = 1.5;
                    }
                } catch (lineError) {
                    console.warn('Could not set line properties:', lineError.message);
                }
                
                await context.sync();
                
                // Add tags for dynamic updates
                bar.tags.add('quizngo-answer-bar', 'true');
                bar.tags.add('answer-number', answer.number.toString());
                
                await context.sync();
                
                // 2. Create Bottom Underline (Dark line below bar)
                const underlineWidth = barWidth + 20; // Wider than bar
                const underlineLeft = barLeft - 10;   // Centered relative to bar
                
                const underline = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
                underline.left = underlineLeft;
                // Move underline up slightly to overlap/hide the bottom border of the bar
                underline.top = chartTop + maxBarHeight - 0.5;
                underline.width = underlineWidth;
                underline.height = 2; // Thin line
                
                // Load properties including line to remove border
                underline.load(['fill', 'line']);
                await context.sync();
                
                underline.fill.setSolidColor(underlineColor);
                
                // Remove border from underline shape to make it crisp
                if (underline.line) {
                    underline.line.visible = false;
                } else if (underline.lineFormat) {
                    underline.lineFormat.visible = false;
                }
                
                await context.sync();
                
                // 3. Create value label on TOP of bar (Thinner font)
                const valueLabel = slide.shapes.addTextBox(answer.value.toString(), {
                    left: barLeft - 10, // Allow some overflow space
                    top: chartTop + (maxBarHeight - barHeight) - 30, // 30px above the bar
                    width: barWidth + 20,
                    height: 30
                });
                
                // Load textFrame
                valueLabel.load(['textFrame', 'tags']);
                await context.sync();
                
                // Set BOTH vertical and horizontal alignment using middleCentered
                try {
                    valueLabel.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                } catch (e) {
                    console.log('Using string for middleCentered alignment');
                    valueLabel.textFrame.verticalAlignment = 'MiddleCentered';
                }
                
                // Disable auto-sizing to ensure centering works properly
                try {
                    valueLabel.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                } catch (e) {
                    console.log('Could not set autoSizeSetting');
                }
                
                // Style the text
                const valueText = valueLabel.textFrame.textRange;
                valueText.load(['font']);
                await context.sync();
                
                // Set font properties
                valueText.font.size = 16;
                valueText.font.name = "Calibri Light";
                valueText.font.color = '#000000';
                valueText.font.bold = false;
                
                await context.sync();
                
                // Add tags for dynamic updates
                valueLabel.tags.add('quizngo-answer-value', 'true');
                valueLabel.tags.add('answer-number', answer.number.toString());
                
                await context.sync();
                
                // 4. Create answer number label BELOW the underline
                const numberLabel = slide.shapes.addTextBox(answer.label, {
                    left: barLeft,
                    top: chartTop + maxBarHeight + 5, // Just below the underline
                    width: barWidth,
                    height: 30
                });
                
                // Load textFrame
                numberLabel.load(['textFrame']);
                await context.sync();
                
                // Set BOTH vertical and horizontal alignment using middleCentered
                try {
                    numberLabel.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                } catch (e) {
                    console.log('Using string for middleCentered alignment');
                    numberLabel.textFrame.verticalAlignment = 'MiddleCentered';
                }
                
                // Disable auto-sizing to ensure centering works properly
                try {
                    numberLabel.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                } catch (e) {
                    console.log('Could not set autoSizeSetting');
                }
                
                // Style the text
                const numberText = numberLabel.textFrame.textRange;
                numberText.load(['font']);
                await context.sync();
                
                // Set font properties
                numberText.font.size = 24;
                numberText.font.name = "Arial";
                numberText.font.color = answer.color;
                numberText.font.bold = true;
                
                await context.sync();
                
                await context.sync();
            }
            
            console.log('✅ Answers distribution bar chart added to slide');
        });
    } catch (error) {
        console.error('Error adding answers distribution:', error);
        showError(t('errors.addAnswersDistribution'));
    }
}

/**
 * Reset Answers Distribution Bar Chart to zeros
 * Resets all bar charts across all slides
 */
export async function resetAnswersDistribution() {
    return await updateAnswersDistribution({ 1: 0, 2: 0, 3: 0, 4: 0 });
}

/**
 * Update Answers Distribution Bar Chart
 * Updates all bar charts across all slides based on answer data
 * @param {Object} answersData - Object with answer counts: { 1: 25, 2: 18, 3: 20, 4: 16 }
 */
export async function updateAnswersDistribution(answersData) {
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // Configuration (Fallback values)
            const slideHeight = 540;
            const maxBarHeight = slideHeight * 0.50; // 270
            const defaultChartBottom = slideHeight * 0.85; // 459
            const defaultChartTop = defaultChartBottom - maxBarHeight; // 135
            
            // Answer colors configuration (must match creation logic)
            const answerColors = {
                1: { fill: '#C00000', border: '#8C0000' },
                2: { fill: '#205285', border: '#143255' },
                3: { fill: '#FFD966', border: '#CCAE33' },
                4: { fill: '#92D050', border: '#649628' }
            };
            
            // Find max value for scaling
            const maxValue = Math.max(...Object.values(answersData), 1);
            
            // Search ALL slides for answer bar elements
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const shapes = slide.shapes;
                
                // Optimized: Load all items in one go
                shapes.load('items');
                await context.sync();
                
                // Optimized: Load tags for all items
                for(let j=0; j < shapes.items.length; j++) {
                    shapes.items[j].tags.load('items/key, items/value');
                }
                await context.sync();
                
                const baselines = {}; // Store baseline Y for each answer number
                const shapesToUpdate = []; // Collect shapes first, then process

                // First pass: identify shapes and collect data
                for (let j = 0; j < shapes.items.length; j++) {
                    const shape = shapes.items[j];
                    let isAnswerBar = false;
                    let isAnswerValue = false;
                    let answerNumber = null;
                    
                    if (shape.tags && shape.tags.items) {
                        for (let k = 0; k < shape.tags.items.length; k++) {
                            const tag = shape.tags.items[k];
                            const key = tag.key.toLowerCase();
                            
                            if (key === 'quizngo-answer-bar') {
                                isAnswerBar = true;
                            } else if (key === 'quizngo-answer-value') {
                                isAnswerValue = true;
                            } else if (key === 'answer-number') {
                                answerNumber = parseInt(tag.value);
                            }
                        }
                    }

                    if (isAnswerBar && answerNumber && answersData[answerNumber] !== undefined) {
                        shapesToUpdate.push({ type: 'bar', shape, answerNumber });
                    }
                    if (isAnswerValue && answerNumber && answersData[answerNumber] !== undefined) {
                         shapesToUpdate.push({ type: 'label', shape, answerNumber });
                    }
                }

                // Load properties for identifying baselines and updating
                if (shapesToUpdate.length > 0) {
                     // Load bar shapes only first
                     const barItems = shapesToUpdate.filter(item => item.type === 'bar');
                     const labelItems = shapesToUpdate.filter(item => item.type === 'label');
                     
                     for(const item of barItems) {
                         // Removed 'line' and 'fill' to prevent issues and isolated geometry updates
                         item.shape.load(['top', 'height', 'visible']);
                     }
                     for(const item of labelItems) {
                         // Added textFrame for label update
                         item.shape.load(['top', 'height', 'textFrame']);
                     }
                     await context.sync();

                     // Second pass: Update bars and collect baselines
                     for(const item of barItems) {
                        const { shape, answerNumber } = item;
                        
                        // Calculate using loaded properties
                        let currentBaseline = shape.top + shape.height;
                        baselines[answerNumber] = currentBaseline;
                        
                        const value = answersData[answerNumber];
                        const calculatedHeight = maxValue > 0 ? (value / maxValue) * maxBarHeight : 0;
                        // Minimum height of 5 to avoid PowerPoint errors
                        const finalHeight = value === 0 ? 5 : Math.max(calculatedHeight, 5); 
                        
                        // Round values to avoid potential precision issues
                        const safeHeight = Math.round(finalHeight * 10) / 10;
                        const safeTop = Math.round((currentBaseline - safeHeight) * 10) / 10;

                        // Always update geometry only - avoid visible property which causes GeneralException
                        shape.height = safeHeight;
                        shape.top = safeTop;
                     }
                    
                    // Sync bars first - this is the critical part
                    await context.sync();

                    // Third pass: Update labels (position AND text)
                    for (const item of labelItems) {
                        const { shape, answerNumber } = item;
                        const value = answersData[answerNumber];
                        const calculatedHeight = maxValue > 0 ? (value / maxValue) * maxBarHeight : 0;
                        const finalHeight = Math.max(calculatedHeight, 5);
                        const actualBarHeight = value === 0 ? 5 : finalHeight;
                        
                        const baseline = baselines[answerNumber] !== undefined 
                            ? baselines[answerNumber] 
                            : (defaultChartTop + maxBarHeight);
                        
                        // Update position and text
                        try {
                             shape.top = baseline - actualBarHeight - 30;
                             if(shape.textFrame) {
                                 shape.textFrame.textRange.text = value.toString();
                             }
                        } catch(labelError) {
                             console.error(`⚠️ Failed to update label ${answerNumber}:`, labelError);
                        }
                    }

                    // Sync labels separately
                    try {
                        await context.sync();
                    } catch (labelSyncError) {
                        console.warn(`⚠️ Label sync warning for slide ${i + 1}:`, labelSyncError.message);
                    }
                }
            }
        });
    } catch (error) {
        console.error('❌ Error updating answers distribution:', error);
        throw error;
    }
}

/**
 * Add Leaderboard Elements
 * Creates 6 textboxes for top 3 players (Name + Score for each)
 */
export async function addLeaderboardElements() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length === 0) {
                showError(t('errors.selectSlideFirst'));
                return;
            }
            
            const slide = slides.items[0];
            
            // Configuration
            const startTop = 150;
            const rowHeight = 80;
            const gap = 30;
            
            // Default Data
            const defaultData = [
                { rank: 1, name: "שחקן מקום 1", score: "9999" },
                { rank: 2, name: "שחקן מקום 2", score: "3333" },
                { rank: 3, name: "שחקן מקום 3", score: "0" }
            ];
            
            for (let i = 0; i < defaultData.length; i++) {
                const item = defaultData[i];
                const currentTop = startTop + i * (rowHeight + gap);
                const startLeft = 175;

                // 1. Name Textbox (Right aligned)
                const nameBox = slide.shapes.addTextBox(item.name, {
                    left: startLeft + 200, // Starts where score box ends
                    top: currentTop,
                    width: 500,
                    height: rowHeight
                });
                
                // 2. Score Textbox (Left side)
                const scoreBox = slide.shapes.addTextBox(item.score, {
                    left: startLeft,
                    top: currentTop,
                    width: 200,
                    height: rowHeight
                });
                
                // Load properties
                nameBox.load(['textFrame', 'tags']);
                scoreBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Remove right margin for name box to ensure it sticks to the edge
                nameBox.textFrame.marginRight = 0;
                
                // Add Tags
                nameBox.tags.add('quizngo-leaderboard-name', 'true');
                nameBox.tags.add('leaderboard-rank', item.rank.toString());
                
                scoreBox.tags.add('quizngo-leaderboard-score', 'true');
                scoreBox.tags.add('leaderboard-rank', item.rank.toString());
                
                await context.sync();
                
                // Style Name
                const nameTextRange = nameBox.textFrame.textRange;
                // IMPORTANT: Load paragraphFormat explicitly on the textRange first
                nameTextRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                nameTextRange.font.size = 40;
                nameTextRange.font.bold = true;
                nameTextRange.font.color = '#000000';
                
                // Explicitly set alignment on the paragraphFormat property of the textRange
                if (nameTextRange.paragraphFormat) {
                    try {
                        // Use Enum if available, otherwise fallback to string
                        if (typeof PowerPoint.ParagraphAlignment !== 'undefined') {
                            nameTextRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.right;
                        } else {
                            nameTextRange.paragraphFormat.alignment = "Right";
                        }
                    } catch (e) {
                        console.log('Alignment setting failed:', e);
                    }
                } else {
                    console.warn("Could not access paragraphFormat for nameBox");
                }

                // Disable auto-sizing to ensure alignment works properly
                try {
                    nameBox.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                    // Set Vertical Alignment to Middle
                    if (typeof PowerPoint.TextVerticalAlignment !== 'undefined') {
                         nameBox.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                    } else {
                         nameBox.textFrame.verticalAlignment = "MiddleCentered";
                    }
                } catch (e) {
                    console.log('Could not set autoSizeSetting or verticalAlignment for nameBox', e);
                }
                
                // Style Score
                const scoreTextRange = scoreBox.textFrame.textRange;
                scoreTextRange.load(['font', 'paragraphFormat']);
                await context.sync();
                
                scoreTextRange.font.size = 40;
                scoreTextRange.font.bold = true;
                scoreTextRange.font.color = '#0078d4'; // Blue for score
                
                if (scoreTextRange.paragraphFormat) {
                    try {
                        // Use Enum if available
                        if (typeof PowerPoint.ParagraphAlignment !== 'undefined') {
                            scoreTextRange.paragraphFormat.alignment = PowerPoint.ParagraphAlignment.left;
                        } else {
                            scoreTextRange.paragraphFormat.alignment = "Left";
                        }
                    } catch (e) {
                        console.log('Alignment setting failed:', e);
                    }
                }

                // Disable auto-sizing and set Vertical Alignment for Score
                try {
                    scoreBox.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                    if (typeof PowerPoint.TextVerticalAlignment !== 'undefined') {
                         scoreBox.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                    } else {
                         scoreBox.textFrame.verticalAlignment = "MiddleCentered";
                    }
                } catch (e) {
                    console.log('Could not set autoSizeSetting or verticalAlignment for scoreBox', e);
                }
                
                await context.sync();
            }
            
            console.log('✅ Leaderboard elements added');
        });
    } catch (error) {
        console.error('Error adding leaderboard elements:', error);
        showError(t('errors.addLeaderboard'));
    }
}

/**
 * Reset Leaderboard to empty state
 * Resets all leaderboard elements across all slides
 */
export async function resetLeaderboard() {
    // Reset with placeholder names and zero scores
    const emptyData = [
        { name: "---", score: 0 },
        { name: "---", score: 0 },
        { name: "---", score: 0 }
    ];
    return await updateLeaderboard(emptyData);
}

/**
 * Update Leaderboard
 * Updates leaderboard elements across all slides
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 * @param {Array} leaderboardData - Array of objects { name: "Player1", score: 1200 }
 */
export async function updateLeaderboard(leaderboardData) {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            // We only care about top 3
            const top3 = leaderboardData.slice(0, 3);
            
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
            
            // Process: Find shapes and collect info for updates
            const shapesToUpdate = [];
            for (const slide of slides.items) {
                for (const shape of slide.shapes.items) {
                    if (shape.tags && shape.tags.items) {
                        let isLeaderboardName = false;
                        let isLeaderboardScore = false;
                        let rank = null;
                        
                        for (const tag of shape.tags.items) {
                            const key = tag.key.toLowerCase();
                            
                            if (key === 'quizngo-leaderboard-name') {
                                isLeaderboardName = true;
                            } else if (key === 'quizngo-leaderboard-score') {
                                isLeaderboardScore = true;
                            } else if (key === 'leaderboard-rank') {
                                rank = parseInt(tag.value);
                            }
                        }
                        
                        if (rank && (isLeaderboardName || isLeaderboardScore)) {
                            shapesToUpdate.push({ shape, isLeaderboardName, isLeaderboardScore, rank });
                        }
                    }
                }
            }
            
            // Update all shapes at once
            for (const item of shapesToUpdate) {
                const player = top3[item.rank - 1]; // rank 1 is index 0
                try {
                    if (player) {
                        if (item.isLeaderboardName) {
                            item.shape.textFrame.textRange.text = player.name || player.nickname || "Unknown";
                        } else if (item.isLeaderboardScore) {
                            item.shape.textFrame.textRange.text = (player.score || 0).toString();
                        }
                    } else {
                        // Less than 3 players, clear text
                        item.shape.textFrame.textRange.text = ""; 
                    }
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            
            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error updating leaderboard:', error);
    }
}
