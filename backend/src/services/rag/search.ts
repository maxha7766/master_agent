/**
 * Vector Search Service
 * Performs hybrid search using separate vector and fulltext functions + RRF
 * Following master-rag implementation pattern
 */

import { supabase } from '../../models/database.js';
import { embeddingsService } from '../embeddings/openai.js';
import { cohereRerankService } from '../rerank/cohere.js';
import { log } from '../../lib/logger.js';

export interface SearchOptions {
  topK?: number;
  vectorThreshold?: number;
  textThreshold?: number;
  minRelevanceScore?: number;
  rrfK?: number; // RRF parameter
  useReranking?: boolean; // Enable Cohere reranking
  rerankTopK?: number; // How many results to rerank
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, any>;
  similarityScore: number;
  relevanceScore: number;
  fileName?: string;
  chunkIndex?: number;
  pageNumber?: number;
}

interface RawVectorResult {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  page_number: number;
  metadata: any;
  similarity: number;
}

interface RawTextResult {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  page_number: number;
  metadata: any;
  rank: number;
}

export class VectorSearchService {
  /**
   * Perform hybrid search combining vector similarity and keyword matching
   * Uses RRF (Reciprocal Rank Fusion) to combine results
   */
  async search(
    query: string,
    userId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      topK = 5,
      vectorThreshold = 0.0, // No threshold - get all results, let RRF and reranking filter
      textThreshold = 0.0, // No threshold - if fulltext works, great, if not, vector carries it
      minRelevanceScore = 0.0, // No threshold - trust the reranking
      rrfK = 60, // Standard RRF parameter
      useReranking = true, // Enable reranking by default if available
      rerankTopK = 20, // Take more candidates for reranking
    } = options;

    try {
      log.info('🔎 SEARCH SERVICE: Starting hybrid search', {
        query,
        userId,
        topK,
        minRelevanceScore,
        vectorThreshold,
        textThreshold,
        useReranking: useReranking && cohereRerankService.isEnabled(),
      });

      // Start fulltext search and embedding generation in parallel
      // Fulltext doesn't need the embedding, so can start immediately
      const fulltextPromise = this.fulltextSearch(query, userId, rerankTopK * 2, textThreshold).catch((error) => {
        log.warn('⚠️ SEARCH SERVICE: Fulltext search failed, continuing with vector only', { error: error.message });
        return [];
      });

      // Generate query embedding (runs in parallel with fulltext search)
      const { embedding: queryEmbedding } = await embeddingsService.embedText(
        query
      );

      log.info('📊 SEARCH SERVICE: Embedding generated', {
        embeddingDimension: queryEmbedding.length
      });

      // Start vector search now that we have the embedding
      // Wait for both vector search and fulltext search to complete
      const [vectorResults, textResults] = await Promise.all([
        this.vectorSearch(queryEmbedding, userId, rerankTopK * 2, vectorThreshold),
        fulltextPromise,
      ]);

      log.info('✅ SEARCH SERVICE: Raw search results retrieved', {
        vectorResults: vectorResults.length,
        textResults: textResults.length,
        topVectorScores: vectorResults.slice(0, 3).map(r => r.similarity),
        topTextRanks: textResults.slice(0, 3).map(r => r.rank),
      });

      // Combine using Reciprocal Rank Fusion
      const hybridResults = this.reciprocalRankFusion(
        vectorResults,
        textResults,
        rrfK
      );

      log.info('🔀 SEARCH SERVICE: RRF fusion complete', {
        hybridResultsCount: hybridResults.length,
        minRelevanceScore,
        rerankTopK,
        topRrfScores: hybridResults.slice(0, 5).map(r => ({
          score: r.relevanceScore,
          content: r.content.substring(0, 60)
        })),
      });

      // Take top candidates for reranking (don't filter yet - RRF scores are low)
      let candidateResults = hybridResults.slice(0, rerankTopK);

      log.info('📋 SEARCH SERVICE: Candidates selected for reranking', {
        candidateCount: candidateResults.length,
        topRrfScores: candidateResults.slice(0, 3).map(r => r.relevanceScore),
      });

      let filteredResults: SearchResult[];

      // OPTIMIZATION: Conditional Cohere reranking
      // Skip reranking if top vector similarity is already high confidence
      const topSimilarity = candidateResults[0]?.similarityScore ?? 0;
      const needsReranking = topSimilarity < 0.85 || candidateResults.length > 5;

      // Apply Cohere reranking if enabled, available, AND needed
      if (useReranking && cohereRerankService.isEnabled() && candidateResults.length > 0 && needsReranking) {
        log.info('🎯 SEARCH SERVICE: Applying Cohere reranking', {
          candidateCount: candidateResults.length,
          targetTopK: topK,
          topSimilarity,
          reason: topSimilarity < 0.85 ? 'Low confidence' : 'Many candidates'
        });

        const rerankDocs = candidateResults.map((r) => ({
          id: r.chunkId,
          text: r.content,
        }));

        const rerankedResults = await cohereRerankService.rerank(
          query,
          rerankDocs,
          { topK: topK }
        );

        // Map reranked results back to SearchResult format with Cohere scores
        const resultsWithCohereScores = rerankedResults.map((rr) => {
          const original = candidateResults.find((f) => f.chunkId === rr.document.id)!;
          return {
            ...original,
            relevanceScore: rr.relevanceScore, // Use Cohere's rerank score (0-1)
          };
        });

        log.info('✨ SEARCH SERVICE: Reranking complete', {
          resultsCount: resultsWithCohereScores.length,
          topCohereScores: resultsWithCohereScores.slice(0, 5).map(r => ({
            score: r.relevanceScore,
            content: r.content.substring(0, 60)
          })),
        });

        // NOW filter by minRelevanceScore (applies to Cohere scores 0-1)
        filteredResults = resultsWithCohereScores.filter(
          (r) => r.relevanceScore >= minRelevanceScore
        );

        log.info('🔍 SEARCH SERVICE: After filtering by minRelevanceScore', {
          filteredCount: filteredResults.length,
          minRelevanceScore,
          filteredOutCount: resultsWithCohereScores.length - filteredResults.length
        });
      } else if (useReranking && cohereRerankService.isEnabled() && !needsReranking) {
        // OPTIMIZATION: Skip reranking for high-confidence results
        log.info('⚡ SEARCH SERVICE: Skipping reranking (high confidence)', {
          topSimilarity,
          candidateCount: candidateResults.length,
        });

        // Use vector similarity scores directly, normalized to 0-1 range
        filteredResults = candidateResults
          .filter((r) => r.similarityScore >= minRelevanceScore)
          .slice(0, topK);
      } else {
        // No reranking available - use RRF scores directly, but lower the threshold
        // RRF scores are typically 0.01-0.03, so we should use a much lower threshold
        const rrfMinScore = Math.min(0.01, minRelevanceScore); // Cap at 0.01 for RRF

        filteredResults = candidateResults
          .filter((r) => r.relevanceScore >= rrfMinScore)
          .slice(0, topK);

        log.info('No reranking - using RRF scores', {
          filteredCount: filteredResults.length,
          rrfMinScore,
        });
      }

      // Enrich with document metadata
      const enrichedResults = await this.enrichResults(filteredResults);

      log.info('✅ SEARCH SERVICE: Hybrid search COMPLETE', {
        userId,
        resultsFound: enrichedResults.length,
        finalResults: enrichedResults.map(r => ({
          doc: r.fileName,
          page: r.pageNumber,
          score: r.relevanceScore,
          preview: r.content.substring(0, 60)
        }))
      });

      return enrichedResults;
    } catch (error) {
      log.error('Search failed', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Perform vector similarity search
   */
  private async vectorSearch(
    queryEmbedding: number[],
    userId: string,
    limit: number,
    threshold: number
  ): Promise<RawVectorResult[]> {
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      target_user_id: userId,
    });

    if (error) {
      log.error('Vector search failed', {
        error: error.message,
        userId,
      });
      throw error;
    }

    return data || [];
  }

  /**
   * Perform full-text search
   */
  private async fulltextSearch(
    query: string,
    userId: string,
    limit: number,
    threshold: number
  ): Promise<RawTextResult[]> {
    const { data, error } = await supabase.rpc('search_documents_fulltext', {
      search_query: query,
      match_threshold: threshold,
      match_count: limit,
      target_user_id: userId,
    });

    if (error) {
      log.error('Full-text search failed', {
        error: error.message,
        userId,
      });
      throw error;
    }

    return data || [];
  }

  /**
   * Combine search results using Reciprocal Rank Fusion (RRF)
   * RRF Score = 1 / (k + rank)
   */
  private reciprocalRankFusion(
    vectorResults: RawVectorResult[],
    textResults: RawTextResult[],
    k: number
  ): Array<SearchResult & { rank: number }> {
    // Map to store combined scores by chunk ID
    const scoreMap = new Map<
      string,
      {
        result: RawVectorResult | RawTextResult;
        vectorScore: number;
        textScore: number;
        combinedScore: number;
      }
    >();

    // Process vector search results
    vectorResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1.0 / (k + rank);

      scoreMap.set(result.id, {
        result,
        vectorScore: rrfScore,
        textScore: 0.0,
        combinedScore: rrfScore,
      });
    });

    // Process text search results
    textResults.forEach((result, index) => {
      const rank = index + 1;
      const rrfScore = 1.0 / (k + rank);

      const existing = scoreMap.get(result.id);
      if (existing) {
        // Chunk found in both searches - add text score
        existing.textScore = rrfScore;
        existing.combinedScore += rrfScore;
      } else {
        // Chunk only found in text search
        scoreMap.set(result.id, {
          result,
          vectorScore: 0.0,
          textScore: rrfScore,
          combinedScore: rrfScore,
        });
      }
    });

    // Sort by combined RRF score
    const sorted = Array.from(scoreMap.values()).sort(
      (a, b) => b.combinedScore - a.combinedScore
    );

    // Convert to SearchResult format
    return sorted.map((item, index) => {
      const result = item.result;
      return {
        chunkId: result.id,
        documentId: result.document_id,
        content: result.content,
        metadata: result.metadata || {},
        similarityScore:
          'similarity' in result ? result.similarity : item.vectorScore,
        relevanceScore: item.combinedScore,
        chunkIndex: result.chunk_index,
        pageNumber: result.page_number,
        rank: index + 1,
      };
    });
  }

  /**
   * Enrich search results with document metadata
   */
  private async enrichResults(
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    const documentIds = [...new Set(results.map((r) => r.documentId))];

    // Fetch document metadata
    const { data: documents } = await supabase
      .from('documents')
      .select('id, file_name')
      .in('id', documentIds);

    const docMap = new Map(documents?.map((d) => [d.id, d]) || []);

    return results.map((r) => {
      const doc = docMap.get(r.documentId);
      return {
        ...r,
        fileName: doc?.file_name,
      };
    });
  }

  /**
   * Search within a specific document
   */
  async searchInDocument(
    query: string,
    documentId: string,
    userId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, vectorThreshold = 0.3 } = options;

    // Generate query embedding
    const { embedding: queryEmbedding } = await embeddingsService.embedText(
      query
    );

    // Search within document using vector similarity
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: vectorThreshold,
      match_count: topK,
      target_user_id: userId,
    });

    if (error) {
      log.error('Document search failed', {
        error: error.message,
        documentId,
      });
      throw error;
    }

    // Filter to only this document
    const documentResults = (data || []).filter(
      (r: RawVectorResult) => r.document_id === documentId
    );

    // Convert to SearchResult format
    const results: SearchResult[] = documentResults.map((r: RawVectorResult) => ({
      chunkId: r.id,
      documentId: r.document_id,
      content: r.content,
      metadata: r.metadata || {},
      similarityScore: r.similarity,
      relevanceScore: r.similarity,
      chunkIndex: r.chunk_index,
      pageNumber: r.page_number,
    }));

    return this.enrichResults(results);
  }
  /**
   * Find relevant documents (not just chunks) for a query
   * Used for Long Context RAG where we want to pass full documents to the LLM
   */
  async findRelevantDocuments(
    query: string,
    userId: string,
    limit: number = 3,
    threshold: number = 0.5
  ): Promise<string[]> {
    // 1. Get more chunks than we need documents (to ensure coverage)
    const chunkLimit = limit * 5;
    
    // 2. Generate query embedding
    const { embedding: queryEmbedding } = await embeddingsService.embedText(query);

    // 3. Vector search
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: chunkLimit,
      target_user_id: userId,
    });

    if (error) {
      log.error('Document discovery failed', { error: error.message, userId });
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 4. Aggregate unique documents
    // We prioritize documents that appear earlier in the results (higher similarity chunks)
    const uniqueDocIds = new Set<string>();
    const relevantDocIds: string[] = [];

    for (const result of data) {
      if (!uniqueDocIds.has(result.document_id)) {
        uniqueDocIds.add(result.document_id);
        relevantDocIds.push(result.document_id);
        
        if (relevantDocIds.length >= limit) {
          break;
        }
      }
    }

    log.info('📄 SEARCH SERVICE: Found relevant documents', {
      query,
      found: relevantDocIds.length,
      docIds: relevantDocIds
    });

    return relevantDocIds;
  }
}

// Singleton instance
export const vectorSearchService = new VectorSearchService();
