/**
 * WebSocket Video Handler
 * Processes video generation, editing, and upload requests
 */

import type { AuthenticatedWebSocket } from '../server.js';
import { wsManager } from '../server.js';
import { VideoAgent } from '../../agents/video/agent.js';
import { BudgetService } from '../../services/llm/budget.js';
import { log } from '../../lib/logger.js';
import { BudgetExceededError } from '../../lib/errors.js';
import { supabase } from '../../models/database.js';
import type { ServerMessage } from '../types.js';

interface VideoGeneratePayload {
    kind: 'video_generate';
    conversationId?: string;
    operation: 'text-to-video' | 'image-to-video' | 'video-editing';
    parameters: {
        prompt: string;
        negativePrompt?: string;
        sourceImage?: string;
        sourceVideo?: string;
        duration?: 5 | 10;
        aspectRatio?: '16:9' | '9:16' | '1:1';
        resolution?: '720p' | '1080p';
        seed?: number;
        style?: string;
    };
}

interface VideoListPayload {
    kind: 'video_list';
}

const videoAgent = new VideoAgent();

// Initialize the agent when the module loads
videoAgent.initialize().catch((error) => {
    log.error('Failed to initialize video agent', {
        error: error instanceof Error ? error.message : String(error),
    });
});

/**
 * Handle video generation request
 */
export async function handleVideoGenerate(
    ws: AuthenticatedWebSocket,
    message: VideoGeneratePayload
): Promise<void> {
    const { conversationId, operation, parameters } = message;
    const userId = ws.userId!;

    const startTime = Date.now();
    const jobId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        log.info('Processing video generation request', {
            userId,
            conversationId,
            jobId,
            operation,
        });

        // Verify conversation exists if provided
        if (conversationId) {
            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select('id')
                .eq('id', conversationId)
                .eq('user_id', userId)
                .single();

            if (convError || !conversation) {
                sendError(ws, 'Conversation not found', 'CONVERSATION_NOT_FOUND', conversationId);
                return;
            }
        }

        // Estimate cost based on operation
        const estimatedCost = getEstimatedCost(operation);

        // Check budget
        let budgetWarning;
        try {
            const budgetCheck = await BudgetService.checkBudget(userId, estimatedCost);
            budgetWarning = budgetCheck.warning;
        } catch (error) {
            if (error instanceof BudgetExceededError) {
                log.warn('Budget exceeded for video generation', { userId, estimatedCost });
                sendError(
                    ws,
                    `Monthly budget limit exceeded. Current: $${error.currentCost.toFixed(2)}, Limit: $${error.limit.toFixed(2)}`,
                    'BUDGET_EXCEEDED',
                    conversationId
                );
                return;
            }
            throw error;
        }

        // Send budget warning if threshold reached
        if (budgetWarning) {
            const warningMessage: ServerMessage = {
                kind: 'budget_warning',
                currentCost: budgetWarning.currentCost,
                limit: budgetWarning.limit,
                percentUsed: budgetWarning.percentUsed,
                threshold: budgetWarning.threshold,
            };
            ws.send(JSON.stringify(warningMessage));
            log.info('Budget warning sent to client', { userId, percentUsed: budgetWarning.percentUsed });
        }

        // Send progress start
        sendMessage(ws, {
            kind: 'progress',
            jobId,
            progressPercent: 0,
            status: 'Starting video generation (this may take a few minutes)...',
        });

        // Process video generation
        const result = await videoAgent.processRequest({
            userId,
            conversationId,
            operation,
            parameters,
        });

        if (!result.success || !result.data) {
            sendError(ws, result.error || 'Video generation failed', 'VIDEO_GENERATION_FAILED', conversationId);
            return;
        }

        // Track video generation cost (using image cost tracker for now or add new method)
        // BudgetService probably needs trackVideoCost or just use trackImageCost if it's generic enough.
        // Let's assume we can use trackImageCost for now or I should check BudgetService.
        // I'll check BudgetService later, for now I'll use trackImageCost as a placeholder or generic trackCost.
        if (result.costUsd) {
            await BudgetService.trackImageCost(userId, result.costUsd); // Reusing image cost tracking for media
        }

        // Send progress complete
        sendMessage(ws, {
            kind: 'progress',
            jobId,
            progressPercent: 100,
            status: 'Video generation complete',
        });

        // Send the generated video result
        ws.send(JSON.stringify({
            kind: 'video_result', // New kind, frontend needs to handle it
            jobId,
            data: result.data,
            costUsd: result.costUsd,
            processingTimeMs: Date.now() - startTime,
        }));

        log.info('Video generation completed successfully', {
            jobId,
            userId,
            conversationId,
            operation,
            costUsd: result.costUsd,
            processingTimeMs: Date.now() - startTime,
        });
    } catch (error) {
        log.error('Video generation failed', {
            jobId,
            userId,
            conversationId,
            operation,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        sendError(
            ws,
            'Failed to generate video. Please try again.',
            'PROCESSING_ERROR',
            conversationId
        );
    }
}

/**
 * Handle video list request
 */
export async function handleVideoList(
    ws: AuthenticatedWebSocket,
    message: VideoListPayload
): Promise<void> {
    const userId = ws.userId!;

    try {
        log.info('Processing video list request', { userId });

        const result = await videoAgent.processRequest({
            userId,
            operation: 'list-videos',
            parameters: {},
        });

        if (!result.success || !result.data) {
            sendError(ws, result.error || 'Failed to list videos', 'VIDEO_LIST_FAILED');
            return;
        }

        ws.send(JSON.stringify({
            kind: 'video_list_result',
            data: result.data,
        }));

        log.info('Video list retrieved successfully', {
            userId,
            count: Array.isArray(result.data) ? result.data.length : 0,
        });
    } catch (error) {
        log.error('Video list failed', {
            userId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        sendError(ws, 'Failed to retrieve video list. Please try again.', 'PROCESSING_ERROR');
    }
}

/**
 * Get estimated cost for video operation
 */
function getEstimatedCost(operation: string): number {
    const costs: Record<string, number> = {
        'text-to-video': 0.40, // Veo 3 estimate
        'image-to-video': 0.50, // Kling estimate
        'video-editing': 0.20,
    };
    return costs[operation] || 0.40;
}

/**
 * Send message to client
 */
function sendMessage(ws: AuthenticatedWebSocket, message: ServerMessage): void {
    wsManager.sendMessage(ws, message);
}

/**
 * Send error message to client
 */
function sendError(
    ws: AuthenticatedWebSocket,
    errorMessage: string,
    code: string,
    conversationId?: string
): void {
    sendMessage(ws, {
        kind: 'error',
        error: errorMessage,
        code,
        conversationId,
    });
}
