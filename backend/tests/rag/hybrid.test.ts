import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ragAgent } from '../../src/agents/rag/index.js';
import { vectorSearchService } from '../../src/services/rag/search.js';
import { documentStorageService } from '../../src/services/documents/storage.js';
import { LLMFactory } from '../../src/services/llm/factory.js';

// Mock dependencies
vi.mock('../../src/services/rag/search.js', () => ({
    vectorSearchService: {
        search: vi.fn(),
        findRelevantDocuments: vi.fn(),
    },
}));

vi.mock('../../src/services/documents/storage.js', () => ({
    documentStorageService: {
        getMultipleDocuments: vi.fn(),
    },
}));

vi.mock('../../src/services/llm/factory.js', () => ({
    LLMFactory: {
        getProvider: vi.fn(),
    },
}));

describe('RAGAgent Hybrid Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use Hybrid Flow (Document Discovery + Hydration) for Gemini 1.5 Pro', async () => {
        // Setup mocks
        const mockDocIds = ['doc-1', 'doc-2'];
        const mockDocMap = new Map([
            ['doc-1', 'Full content of document 1'],
            ['doc-2', 'Full content of document 2'],
        ]);

        // Mock Vector Search to return doc IDs
        vi.mocked(vectorSearchService.findRelevantDocuments).mockResolvedValue(mockDocIds);

        // Mock Document Storage to return full text
        vi.mocked(documentStorageService.getMultipleDocuments).mockResolvedValue(mockDocMap);

        // Mock LLM Provider
        const mockChat = vi.fn().mockResolvedValue({
            content: 'Hybrid response',
            tokensUsed: 100,
        });
        vi.mocked(LLMFactory.getProvider).mockReturnValue({
            chat: mockChat,
            chatStream: vi.fn(),
            countTokens: vi.fn(),
            getSupportedModels: vi.fn(),
            name: 'gemini',
        } as any);

        // Execute
        const response = await ragAgent.generateResponse('test query', 'user-1', {
            model: 'gemini-1.5-pro',
        });

        // Verify
        expect(vectorSearchService.findRelevantDocuments).toHaveBeenCalledWith('test query', 'user-1', 3);
        expect(documentStorageService.getMultipleDocuments).toHaveBeenCalledWith(mockDocIds, 'user-1');
        expect(vectorSearchService.search).not.toHaveBeenCalled(); // Should NOT use chunk search

        // Verify LLM call contains full context
        const llmCallArgs = mockChat.mock.calls[0];
        const messages = llmCallArgs[0];
        const userMessage = messages.find((m: any) => m.role === 'user');

        expect(userMessage.content).toContain('Full content of document 1');
        expect(userMessage.content).toContain('Full content of document 2');
        expect(response.content).toBe('Hybrid response');
        expect(response.metadata.model).toBe('gemini-1.5-pro');
    });

    it('should use Standard Flow (Chunk Search) for Claude', async () => {
        // Setup mocks
        const mockChunks = [
            { documentId: 'doc-1', content: 'Chunk 1', relevanceScore: 0.9 },
        ];

        vi.mocked(vectorSearchService.search).mockResolvedValue(mockChunks as any);

        const mockChat = vi.fn().mockResolvedValue({
            content: 'Standard response',
            tokensUsed: 50,
        });
        vi.mocked(LLMFactory.getProvider).mockReturnValue({
            chat: mockChat,
            chatStream: vi.fn(),
        } as any);

        // Execute
        await ragAgent.generateResponse('test query', 'user-1', {
            model: 'claude-sonnet-4-5',
        });

        // Verify
        expect(vectorSearchService.search).toHaveBeenCalled();
        expect(vectorSearchService.findRelevantDocuments).not.toHaveBeenCalled();
        expect(documentStorageService.getMultipleDocuments).not.toHaveBeenCalled();
    });
});
