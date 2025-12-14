/**
 * REST API Client
 * Handles HTTP requests to backend with authentication
 */

import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Get authorization headers with current session token
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log('[API] Getting auth headers:', {
    hasSession: !!session,
    hasToken: !!session?.access_token,
    tokenLength: session?.access_token?.length
  });

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
    console.log('[API] Authorization header set');
  } else {
    console.warn('[API] No session token available!');
  }

  return headers;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await getAuthHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // Parse response body
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      const message = data?.error?.message || data?.message || 'Request failed';
      const code = data?.error?.code || data?.code;
      throw new APIError(message, response.status, code);
    }

    return data as T;
  } catch (error) {
    // Re-throw APIError as-is
    if (error instanceof APIError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new APIError('Network error: Unable to reach server', 503, 'NETWORK_ERROR');
    }

    // Handle other errors
    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * API client with typed methods for all endpoints
 */
export const api = {
  // ============================================================================
  // Conversations
  // ============================================================================

  async getConversations(grouped?: boolean): Promise<Conversation[] | GroupedConversations> {
    const params = grouped ? '?grouped=true' : '';
    if (grouped) {
      return fetchAPI<GroupedConversations>(`/api/conversations${params}`);
    }
    return fetchAPI<Conversation[]>(`/api/conversations${params}`);
  },

  async getConversation(id: string): Promise<ConversationDetail> {
    return fetchAPI<ConversationDetail>(`/api/conversations/${id}`);
  },

  async createConversation(title?: string): Promise<Conversation> {
    return fetchAPI<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async updateConversation(
    id: string,
    updates: { title?: string; archived?: boolean }
  ): Promise<Conversation> {
    return fetchAPI<Conversation>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteConversation(id: string): Promise<void> {
    return fetchAPI<void>(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  // ============================================================================
  // Documents
  // ============================================================================

  async getDocuments(): Promise<Document[]> {
    return fetchAPI<Document[]>('/api/documents');
  },

  async getDocument(id: string): Promise<DocumentDetail> {
    return fetchAPI<DocumentDetail>(`/api/documents/${id}`);
  },

  async uploadDocument(file: File, metadata?: Record<string, any>): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const headers = await getAuthHeaders();
    delete (headers as any)['Content-Type']; // Let browser set multipart boundary

    const response = await fetch(`${API_BASE_URL}/api/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new APIError(
        data?.error?.message || 'Upload failed',
        response.status,
        data?.error?.code
      );
    }

    return response.json();
  },

  async deleteDocument(id: string): Promise<void> {
    return fetchAPI<void>(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  },

  async searchDocuments(query: string, limit?: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ query });
    if (limit) params.append('limit', limit.toString());
    return fetchAPI<SearchResult[]>(`/api/documents/search?${params}`);
  },

  // ============================================================================
  // Settings
  // ============================================================================

  async getSettings(): Promise<UserSettings> {
    return fetchAPI<UserSettings>('/api/settings');
  },

  async updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
    return fetchAPI<UserSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // ============================================================================
  // Usage & Budget
  // ============================================================================

  async getUsage(month?: string): Promise<UsageStats> {
    const params = month ? `?month=${month}` : '';
    return fetchAPI<UsageStats>(`/api/usage${params}`);
  },

  async getBudgetStatus(): Promise<BudgetStatus> {
    return fetchAPI<BudgetStatus>('/api/usage/budget');
  },

  // ============================================================================
  // Database Connections
  // ============================================================================

  async getDatabaseConnections(): Promise<DatabaseConnection[]> {
    const response = await fetchAPI<{ connections: DatabaseConnection[] }>(
      '/api/database-connections'
    );
    return response.connections;
  },

  async getDatabaseConnection(id: string): Promise<DatabaseConnection> {
    return fetchAPI<DatabaseConnection>(`/api/database-connections/${id}`);
  },

  async createDatabaseConnection(
    name: string,
    connectionString: string
  ): Promise<DatabaseConnection> {
    return fetchAPI<DatabaseConnection>('/api/database-connections', {
      method: 'POST',
      body: JSON.stringify({ name, connectionString }),
    });
  },

  async updateDatabaseConnection(
    id: string,
    updates: {
      name?: string;
      connectionString?: string;
      active?: boolean;
    }
  ): Promise<DatabaseConnection> {
    return fetchAPI<DatabaseConnection>(`/api/database-connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteDatabaseConnection(id: string): Promise<void> {
    return fetchAPI<void>(`/api/database-connections/${id}`, {
      method: 'DELETE',
    });
  },

  async testDatabaseConnection(id: string): Promise<{ success: boolean; message: string }> {
    return fetchAPI<{ success: boolean; message: string }>(
      `/api/database-connections/${id}/test`,
      {
        method: 'POST',
      }
    );
  },

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return fetchAPI<{ status: string; timestamp: string }>('/health');
  },

  // ============================================================================
  // Research
  // ============================================================================

  async executeResearch(query: string, maxResults?: number): Promise<ResearchResult> {
    return fetchAPI<ResearchResult>('/api/research', {
      method: 'POST',
      body: JSON.stringify({ query, maxResults }),
    });
  },

  async createGraduateResearch(
    topic: string,
    wordCountTarget: number,
    citationStyle: 'APA' | 'MLA' | 'Chicago'
  ): Promise<GraduateResearchProject> {
    return fetchAPI<GraduateResearchProject>('/api/research/graduate', {
      method: 'POST',
      body: JSON.stringify({ topic, wordCountTarget, citationStyle }),
    });
  },

  async getResearchProject(projectId: string): Promise<GraduateResearchProject> {
    return fetchAPI<GraduateResearchProject>(`/api/research/graduate/${projectId}`);
  },

  async getResearchProjects(): Promise<GraduateResearchProject[]> {
    return fetchAPI<GraduateResearchProject[]>('/api/research/graduate');
  },

  async createTopicResearch(
    topic: string,
    numSources: number = 10
  ): Promise<{ success: boolean; projectId: string }> {
    return fetchAPI<{ success: boolean; projectId: string }>('/api/research/topic', {
      method: 'POST',
      body: JSON.stringify({ topic, numSources }),
    });
  },
};

// ============================================================================
// Type Definitions
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  messageCount?: number;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  model?: string;
  tokensUsed?: number;
  costUsd?: number;
  sources?: SearchSource[];
  imageUrl?: string;
  videoUrl?: string;
  imageMetadata?: {
    operation: string;
    width: number;
    height: number;
    prompt?: string;
  };
  createdAt: string;
}

export interface SearchSource {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  relevanceScore: number;
}

export interface Document {
  id: string;
  title: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  chunkCount?: number;
  tokenCount?: number;
}

export interface DocumentDetail extends Document {
  metadata: Record<string, any>;
  chunks?: Chunk[];
}

export interface Chunk {
  id: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  default_chat_model: string;
  monthly_budget_limit: number;
  rag_model?: string;
  sql_model?: string;
  research_model?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UsageStats {
  month: string;
  totalMessages: number;
  totalTokens: number;
  totalCostUsd: number;
  budgetLimitUsd: number;
  budgetRemaining: number;
  costByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
}

export interface BudgetStatus {
  currentCostUsd: number;
  limitUsd: number;
  remainingUsd: number;
  percentUsed: number;
  warningThreshold: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export interface GroupedConversations {
  today: Conversation[];
  yesterday: Conversation[];
  lastWeek: Conversation[];
  older: Conversation[];
}

export interface ResearchSource {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  author?: string;
  source: 'tavily' | 'brave';
}

export interface ResearchResult {
  success: boolean;
  data: {
    query: string;
    sources: ResearchSource[];
    summary?: string;
    domain: string;
    totalResults: number;
    document: {
      id: string;
      filename: string;
      title: string;
    };
    markdown: string;
  };
}

export interface GraduateResearchProject {
  success: boolean;
  projectId: string;
  message?: string;
  id?: string;
  topic?: string;
  status?: 'planning' | 'researching' | 'analyzing' | 'writing' | 'assembling' | 'complete' | 'failed';
  word_count_target?: number;
  citation_style?: 'APA' | 'MLA' | 'Chicago';
  current_phase?: string;
  progress_metadata?: {
    sources_count?: number;
    themes_count?: number;
    sections_completed?: number;
    current_word_count?: number;
  };
  final_report?: string;
  final_word_count?: number;
  created_at?: string;
  updated_at?: string;
}
