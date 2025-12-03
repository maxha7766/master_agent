/**
 * Document Storage Service
 * Handles retrieval of full document content from chunks
 */

import { supabase } from '../../models/database.js';
import { log } from '../../lib/logger.js';

export class DocumentStorageService {
    /**
     * Reconstruct full document text from chunks
     * Used for Long Context RAG where we need the entire document
     */
    async getFullDocumentText(documentId: string, userId: string): Promise<string> {
        try {
            // Fetch all chunks for the document, ordered by index
            const { data: chunks, error } = await supabase
                .from('chunks')
                .select('content, chunk_index')
                .eq('document_id', documentId)
                .eq('user_id', userId)
                .order('chunk_index', { ascending: true });

            if (error) {
                log.error('Failed to fetch document chunks', {
                    documentId,
                    error: error.message
                });
                throw error;
            }

            if (!chunks || chunks.length === 0) {
                log.warn('No chunks found for document', { documentId });
                return '';
            }

            // Concatenate chunks
            // Note: We might need to handle overlap if we want perfect reconstruction,
            // but for LLM context, simple concatenation is usually fine even with overlap.
            // However, if we want to be precise, we should use start_char/end_char if available.
            // For now, simple concatenation with space is a safe start.
            const fullText = chunks.map(c => c.content).join(' ');

            log.info('📖 DOCUMENT STORAGE: Reconstructed full document', {
                documentId,
                chunkCount: chunks.length,
                totalLength: fullText.length
            });

            return fullText;
        } catch (error) {
            log.error('Error reconstructing document', {
                documentId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get multiple documents' full text
     */
    async getMultipleDocuments(documentIds: string[], userId: string): Promise<Map<string, string>> {
        const resultMap = new Map<string, string>();

        // Process in parallel
        await Promise.all(
            documentIds.map(async (id) => {
                const text = await this.getFullDocumentText(id, userId);
                if (text) {
                    resultMap.set(id, text);
                }
            })
        );

        return resultMap;
    }
}

// Singleton instance
export const documentStorageService = new DocumentStorageService();
