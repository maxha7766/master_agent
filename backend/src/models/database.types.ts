/**
 * Database TypeScript Types
 * Generated from Supabase schema
 *
 * Note: Run `supabase gen types typescript --local > src/models/database.types.ts`
 * to regenerate after schema changes
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          default_chat_model: string;
          default_rag_model: string;
          default_sql_model: string;
          default_research_model: string;
          default_research_depth: 'quick' | 'standard' | 'deep';
          theme: 'light' | 'dark' | 'system';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_chat_model?: string;
          default_rag_model?: string;
          default_sql_model?: string;
          default_research_model?: string;
          default_research_depth?: 'quick' | 'standard' | 'deep';
          theme?: 'light' | 'dark' | 'system';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_chat_model?: string;
          default_rag_model?: string;
          default_sql_model?: string;
          default_research_model?: string;
          default_research_depth?: 'quick' | 'standard' | 'deep';
          theme?: 'light' | 'dark' | 'system';
          created_at?: string;
          updated_at?: string;
        };
      };
      user_usage: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          total_cost_usd: number;
          usage_by_model: Json;
          created_at: string;
          updated_at: string;
          budget_warning_sent: boolean;
          budget_limit_reached: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          total_cost_usd?: number;
          usage_by_model?: Json;
          created_at?: string;
          updated_at?: string;
          budget_warning_sent?: boolean;
          budget_limit_reached?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          total_cost_usd?: number;
          usage_by_model?: Json;
          created_at?: string;
          updated_at?: string;
          budget_warning_sent?: boolean;
          budget_limit_reached?: boolean;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          agent_used: string | null;
          model_used: string | null;
          tokens_used: number | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          agent_used?: string | null;
          model_used?: string | null;
          tokens_used?: number | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          agent_used?: string | null;
          model_used?: string | null;
          tokens_used?: number | null;
          latency_ms?: number | null;
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          status: 'processing' | 'completed' | 'failed';
          error_message: string | null;
          page_count: number | null;
          chunk_count: number;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          status?: 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          page_count?: number | null;
          chunk_count?: number;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          file_url?: string;
          status?: 'processing' | 'completed' | 'failed';
          error_message?: string | null;
          page_count?: number | null;
          chunk_count?: number;
          created_at?: string;
          processed_at?: string | null;
        };
      };
      chunks: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          page_number: number | null;
          start_char: number | null;
          end_char: number | null;
          token_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          page_number?: number | null;
          start_char?: number | null;
          end_char?: number | null;
          token_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          content?: string;
          embedding?: number[] | null;
          chunk_index?: number;
          page_number?: number | null;
          start_char?: number | null;
          end_char?: number | null;
          token_count?: number;
          created_at?: string;
        };
      };
      database_connections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          db_type: string;
          connection_string: string;
          status: 'validating' | 'active' | 'failed';
          last_validated_at: string | null;
          error_message: string | null;
          schema_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          db_type?: string;
          connection_string: string;
          status?: 'validating' | 'active' | 'failed';
          last_validated_at?: string | null;
          error_message?: string | null;
          schema_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          db_type?: string;
          connection_string?: string;
          status?: 'validating' | 'active' | 'failed';
          last_validated_at?: string | null;
          error_message?: string | null;
          schema_snapshot?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      research_reports: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          query: string;
          depth: 'quick' | 'standard' | 'deep';
          status: 'pending' | 'in_progress' | 'completed' | 'failed';
          progress_percent: number;
          content: Json | null;
          source_count: number;
          model_used: string | null;
          total_tokens: number | null;
          duration_seconds: number | null;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          query: string;
          depth: 'quick' | 'standard' | 'deep';
          status?: 'pending' | 'in_progress' | 'completed' | 'failed';
          progress_percent?: number;
          content?: Json | null;
          source_count?: number;
          model_used?: string | null;
          total_tokens?: number | null;
          duration_seconds?: number | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          query?: string;
          depth?: 'quick' | 'standard' | 'deep';
          status?: 'pending' | 'in_progress' | 'completed' | 'failed';
          progress_percent?: number;
          content?: Json | null;
          source_count?: number;
          model_used?: string | null;
          total_tokens?: number | null;
          duration_seconds?: number | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      search_sources: {
        Row: {
          id: string;
          user_id: string;
          research_report_id: string | null;
          message_id: string | null;
          url: string;
          title: string | null;
          snippet: string | null;
          credibility_score: number | null;
          domain: string | null;
          publish_date: string | null;
          author: string | null;
          provider: string | null;
          retrieved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          research_report_id?: string | null;
          message_id?: string | null;
          url: string;
          title?: string | null;
          snippet?: string | null;
          credibility_score?: number | null;
          domain?: string | null;
          publish_date?: string | null;
          author?: string | null;
          provider?: string | null;
          retrieved_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          research_report_id?: string | null;
          message_id?: string | null;
          url?: string;
          title?: string | null;
          snippet?: string | null;
          credibility_score?: number | null;
          domain?: string | null;
          publish_date?: string | null;
          author?: string | null;
          provider?: string | null;
          retrieved_at?: string;
        };
      };
    };
    Functions: {
      check_user_budget: {
        Args: { p_user_id: string; p_estimated_cost: number };
        Returns: boolean;
      };
    };
  };
}
