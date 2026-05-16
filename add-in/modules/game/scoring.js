/**
 * Scoring Module
 * Handles answer validation and score calculation for QuizNGO game
 */

import { getParticipantsData, getCurrentQuestionAnswers } from '../core/websocket.js';
import { getSlideData } from '../core/state.js';
import { getApiUrl } from '../core/api.js';

/**
 * Calculate score based on answer time
 * Formula: 1000 * (questionTime - answerTime) / questionTime
 * 
 * @param {number} questionTime - Total time for the question in seconds
 * @param {number} answerTime - Time taken to answer in seconds
 * @returns {number} Score (0-1000)
 */
export function calculateScore(questionTime, answerTime) {
    if (answerTime <= 0) {
        return 1000; // Instant answer = max score
    }
    
    if (answerTime >= questionTime) {
        return 0; // Too late = no score
    }
    
    const score = Math.round(1000 * (questionTime - answerTime) / questionTime);
    return Math.max(0, Math.min(1000, score)); // Clamp between 0-1000
}

function normalizeCorrectAnswer(value) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
        return null;
    }

    if (parsed >= 1 && parsed <= 4) {
        return parsed;
    }

    return null;
}

/**
 * Process answers and calculate scores for current question
 * 
 * @param {string} slideId - The current slide UUID
 * @param {number} questionStartTime - Timestamp when question started (answer time started)
 * @param {number} questionTime - Total time for the question in seconds
 * @returns {Object} Processed results with scores and rankings
 */
export async function processAnswersAndScores(slideId, questionStartTime, questionTime) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 PROCESSING ANSWERS AND SCORES');
    console.log(`📄 Slide ID: ${slideId}`);
    console.log(`⏱️ Question start time: ${questionStartTime}`);
    console.log(`⏱️ Question duration: ${questionTime}s`);
    
    // Get slide data to find correct answer
    const slideData = getSlideData(slideId);
    if (!slideData || slideData.correctAnswer === undefined || slideData.correctAnswer === null || slideData.correctAnswer === '') {
        console.error('❌ No correct answer defined for this slide!');
        return null;
    }
    
    const correctAnswer = normalizeCorrectAnswer(slideData.correctAnswer); // 1, 2, 3, or 4
    if (!correctAnswer) {
        console.error('❌ Invalid correct answer defined for this slide:', slideData.correctAnswer);
        return null;
    }

    console.log(`✅ Correct answer: ${correctAnswer}`);
    
    // Get participants data and current answers
    const participantsData = getParticipantsData();
    const currentAnswers = getCurrentQuestionAnswers();
    
    console.log(`👥 Total participants: ${participantsData.size}`);
    console.log(`📝 Total answers received: ${currentAnswers.size}`);
    
    // Process each participant
    const results = [];
    
    for (const [userId, participantData] of participantsData.entries()) {
        const answerData = currentAnswers.get(userId);
        
        let isCorrect = false;
        let questionScore = 0;
        let answerTime = questionTime; // Default: full time (no answer)
        
        if (answerData) {
            // Player answered
            const { answerIndex, timestamp } = answerData;
            
            // Calculate answer time in seconds
            answerTime = (timestamp - questionStartTime) / 1000;
            
            // Check if correct
            isCorrect = (answerIndex === correctAnswer);
            
            if (isCorrect) {
                // Calculate score based on answer time
                questionScore = calculateScore(questionTime, answerTime);
                console.log(`✅ ${participantData.nickname}: Correct! Time: ${answerTime.toFixed(2)}s, Score: ${questionScore}`);
            } else {
                console.log(`❌ ${participantData.nickname}: Incorrect (answered ${answerIndex}, correct is ${correctAnswer})`);
            }
        } else {
            // Player didn't answer
            console.log(`⏰ ${participantData.nickname}: No answer (timeout)`);
        }
        
        // Update participant's cumulative score
        const newScore = participantData.score + questionScore;
        const correctStreak = isCorrect ? (participantData.correctStreak || 0) + 1 : 0;
        const correctAnswers = (participantData.correctAnswers || 0) + (isCorrect ? 1 : 0);
        const questionsAnswered = (participantData.questionsAnswered || 0) + 1;
        const bestStreak = Math.max(participantData.bestStreak || 0, correctStreak);
        
        results.push({
            userId: userId,
            nickname: participantData.nickname,
            questionScore: questionScore,
            cumulativeScore: newScore,
            isCorrect: isCorrect,
            correctAnswer: correctAnswer,
            streakCount: correctStreak,
            correctAnswers: correctAnswers,
            totalQuestions: questionsAnswered,
            bestStreak: bestStreak,
            answerTime: answerTime,
            answered: !!answerData
        });
        
        // Update the participant data in memory
        participantData.score = newScore;
        participantData.correctStreak = correctStreak;
        participantData.correctAnswers = correctAnswers;
        participantData.questionsAnswered = questionsAnswered;
        participantData.bestStreak = bestStreak;
        participantData.lastAnswerTime = answerTime;
        participantData.lastAnswerCorrect = isCorrect;
    }
    
    // Sort by cumulative score (descending) to get rankings
    results.sort((a, b) => b.cumulativeScore - a.cumulativeScore);
    
    // Add rankings
    results.forEach((result, index) => {
        result.rank = index + 1;
    });
    
    console.log('📊 FINAL RESULTS:');
    results.forEach(r => {
        console.log(`  ${r.rank}. ${r.nickname}: ${r.cumulativeScore} pts (this Q: ${r.questionScore}, streak: ${r.streakCount}, ${r.isCorrect ? '✅' : '❌'})`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return results;
}

/**
 * Send results to server
 * 
 * @param {string} gamePin - Game PIN (primary identifier)
 * @param {Array} results - Processed results with scores and rankings
 */
export async function sendResultsToServer(gamePin, results) {
    try {
        console.log('📤 Sending results to server...');
        console.log('📤 gamePin:', gamePin);
        console.log('📤 results count:', results?.length);
        
        if (!gamePin) {
            console.error('❌ Cannot send results - gamePin is missing');
            console.error('   gamePin value:', gamePin);
            throw new Error('Missing gamePin - cannot send results to server');
        }
        
        if (!results || results.length === 0) {
            console.warn('⚠️ No results to send');
            return { status: 'success', message: 'No results to send' };
        }
        
        const correctAnswer = results[0]?.correctAnswer;
        const response = await fetch(getApiUrl('submit_results'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gamePin: gamePin,
                correctAnswer: correctAnswer,
                results: results,
                timestamp: Date.now()
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Server error response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Results sent successfully:', data);
        
        return data;
    } catch (error) {
        console.error('❌ Error sending results to server:', error);
        throw error;
    }
}
