export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_logs: {
        Row: {
          action: string
          agent_type: string
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          project_id: string
          success: boolean
        }
        Insert: {
          action: string
          agent_type: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          project_id: string
          success?: boolean
        }
        Update: {
          action?: string
          agent_type?: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          project_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string | null
          document_id: string
          embedding: string | null
          end_char: number | null
          id: string
          metadata: Json | null
          page_number: number | null
          position: number
          start_char: number | null
          token_count: number
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string | null
          document_id: string
          embedding?: string | null
          end_char?: number | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          position: number
          start_char?: number | null
          token_count: number
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          end_char?: number | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          position?: number
          start_char?: number | null
          token_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          conversation_id: string
          created_at: string | null
          entities_mentioned: string[] | null
          id: string
          key_points: string[] | null
          message_range_end: string | null
          message_range_start: string | null
          summary: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          entities_mentioned?: string[] | null
          id?: string
          key_points?: string[] | null
          message_range_end?: string | null
          message_range_start?: string | null
          summary: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          entities_mentioned?: string[] | null
          id?: string
          key_points?: string[] | null
          message_range_end?: string | null
          message_range_start?: string | null
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      database_connections: {
        Row: {
          active: boolean
          connection_string_encrypted: string | null
          created_at: string
          database_encrypted: string | null
          db_type: string
          description: string | null
          encrypted_connection_string: string
          host_encrypted: string | null
          id: string
          last_connected_at: string | null
          last_error: string | null
          last_schema_refresh: string | null
          name: string
          password_encrypted: string | null
          port_encrypted: string | null
          schema_cache: Json | null
          status: string | null
          updated_at: string
          user_id: string
          username_encrypted: string | null
        }
        Insert: {
          active?: boolean
          connection_string_encrypted?: string | null
          created_at?: string
          database_encrypted?: string | null
          db_type?: string
          description?: string | null
          encrypted_connection_string: string
          host_encrypted?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          last_schema_refresh?: string | null
          name: string
          password_encrypted?: string | null
          port_encrypted?: string | null
          schema_cache?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
          username_encrypted?: string | null
        }
        Update: {
          active?: boolean
          connection_string_encrypted?: string | null
          created_at?: string
          database_encrypted?: string | null
          db_type?: string
          description?: string | null
          encrypted_connection_string?: string
          host_encrypted?: string | null
          id?: string
          last_connected_at?: string | null
          last_error?: string | null
          last_schema_refresh?: string | null
          name?: string
          password_encrypted?: string | null
          port_encrypted?: string | null
          schema_cache?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
          username_encrypted?: string | null
        }
        Relationships: []
      }
      document_data: {
        Row: {
          created_at: string
          document_id: string
          document_metadata: Json | null
          id: string
          row_data: Json
          row_index: number
        }
        Insert: {
          created_at?: string
          document_id: string
          document_metadata?: Json | null
          id?: string
          row_data: Json
          row_index: number
        }
        Update: {
          created_at?: string
          document_id?: string
          document_metadata?: Json | null
          id?: string
          row_data?: Json
          row_index?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          chunk_count: number | null
          column_count: number | null
          content_hash: string | null
          created_at: string | null
          data_quality_score: number | null
          error_message: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          page_count: number | null
          processed_at: string | null
          processing_progress: Json | null
          processing_status: string | null
          row_count: number | null
          semantic_schema: Json | null
          status: string
          storage_path: string | null
          summary: string | null
          title: string | null
          user_description: string | null
          user_id: string
        }
        Insert: {
          chunk_count?: number | null
          column_count?: number | null
          content_hash?: string | null
          created_at?: string | null
          data_quality_score?: number | null
          error_message?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          page_count?: number | null
          processed_at?: string | null
          processing_progress?: Json | null
          processing_status?: string | null
          row_count?: number | null
          semantic_schema?: Json | null
          status?: string
          storage_path?: string | null
          summary?: string | null
          title?: string | null
          user_description?: string | null
          user_id: string
        }
        Update: {
          chunk_count?: number | null
          column_count?: number | null
          content_hash?: string | null
          created_at?: string | null
          data_quality_score?: number | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          page_count?: number | null
          processed_at?: string | null
          processing_progress?: Json | null
          processing_status?: string | null
          row_count?: number | null
          semantic_schema?: Json | null
          status?: string
          storage_path?: string | null
          summary?: string | null
          title?: string | null
          user_description?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          attributes: Json | null
          created_at: string | null
          description: string | null
          embedding: string | null
          entity_type: string
          first_mentioned_at: string | null
          id: string
          importance_score: number | null
          last_mentioned_at: string | null
          mention_count: number | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          entity_type: string
          first_mentioned_at?: string | null
          id?: string
          importance_score?: number | null
          last_mentioned_at?: string | null
          mention_count?: number | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          description?: string | null
          embedding?: string | null
          entity_type?: string
          first_mentioned_at?: string | null
          id?: string
          importance_score?: number | null
          last_mentioned_at?: string | null
          mention_count?: number | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entity_relationships: {
        Row: {
          context: string | null
          created_at: string | null
          id: string
          relationship_type: string
          source_entity_id: string
          strength: number | null
          target_entity_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          id?: string
          relationship_type: string
          source_entity_id: string
          strength?: number | null
          target_entity_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          id?: string
          relationship_type?: string
          source_entity_id?: string
          strength?: number | null
          target_entity_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      graded_cards: {
        Row: {
          attributes: string | null
          brand: string | null
          card_number: string | null
          card_year: number | null
          cost: number | null
          created_at: string | null
          estimated_value: number | null
          grade: string | null
          grading_cost: number | null
          id: number
          player_name: string | null
          total_cost: number | null
        }
        Insert: {
          attributes?: string | null
          brand?: string | null
          card_number?: string | null
          card_year?: number | null
          cost?: number | null
          created_at?: string | null
          estimated_value?: number | null
          grade?: string | null
          grading_cost?: number | null
          id?: number
          player_name?: string | null
          total_cost?: number | null
        }
        Update: {
          attributes?: string | null
          brand?: string | null
          card_number?: string | null
          card_year?: number | null
          cost?: number | null
          created_at?: string | null
          estimated_value?: number | null
          grade?: string | null
          grading_cost?: number | null
          id?: number
          player_name?: string | null
          total_cost?: number | null
        }
        Relationships: []
      }
      images: {
        Row: {
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          generated_image_url: string
          height: number
          id: string
          model: string
          negative_prompt: string | null
          operation_type: string
          parameters: Json
          prompt: string
          source_image_url: string | null
          storage_path: string
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_image_url: string
          height: number
          id?: string
          model: string
          negative_prompt?: string | null
          operation_type: string
          parameters?: Json
          prompt: string
          source_image_url?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
          width: number
        }
        Update: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          generated_image_url?: string
          height?: number
          id?: string
          model?: string
          negative_prompt?: string | null
          operation_type?: string
          parameters?: Json
          prompt?: string
          source_image_url?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "images_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_used: string | null
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          image_metadata: Json | null
          image_url: string | null
          latency_ms: number | null
          model_used: string | null
          role: string
          sources_used: Json | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          agent_used?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          image_metadata?: Json | null
          image_url?: string | null
          latency_ms?: number | null
          model_used?: string | null
          role: string
          sources_used?: Json | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          agent_used?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          image_metadata?: Json | null
          image_url?: string | null
          latency_ms?: number | null
          model_used?: string | null
          role?: string
          sources_used?: Json | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          agency: string | null
          coupon: number | null
          created_at: string | null
          current_face: number | null
          cusip: string
          date: string
          dealer: string | null
          id: string
          inventory_id: string
          loans: number | null
          max_lns: number | null
          offer: string | null
          offer_metadata: Json | null
          offer_type: string | null
          offer_value: number | null
          original_face: number | null
          pool: string
          servicer: string | null
          source: string
          story: string | null
          story_type: string | null
          term: string | null
          tpo: number | null
          wac: number | null
          wala: number | null
          wam: number | null
          waols: number | null
          waoltv: number | null
        }
        Insert: {
          agency?: string | null
          coupon?: number | null
          created_at?: string | null
          current_face?: number | null
          cusip: string
          date: string
          dealer?: string | null
          id?: string
          inventory_id: string
          loans?: number | null
          max_lns?: number | null
          offer?: string | null
          offer_metadata?: Json | null
          offer_type?: string | null
          offer_value?: number | null
          original_face?: number | null
          pool: string
          servicer?: string | null
          source: string
          story?: string | null
          story_type?: string | null
          term?: string | null
          tpo?: number | null
          wac?: number | null
          wala?: number | null
          wam?: number | null
          waols?: number | null
          waoltv?: number | null
        }
        Update: {
          agency?: string | null
          coupon?: number | null
          created_at?: string | null
          current_face?: number | null
          cusip?: string
          date?: string
          dealer?: string | null
          id?: string
          inventory_id?: string
          loans?: number | null
          max_lns?: number | null
          offer?: string | null
          offer_metadata?: Json | null
          offer_type?: string | null
          offer_value?: number | null
          original_face?: number | null
          pool?: string
          servicer?: string | null
          source?: string
          story?: string | null
          story_type?: string | null
          term?: string | null
          tpo?: number | null
          wac?: number | null
          wala?: number | null
          wam?: number | null
          waols?: number | null
          waoltv?: number | null
        }
        Relationships: []
      }
      query_history: {
        Row: {
          confidence_score: number | null
          created_at: string
          documents_used: string[]
          error_message: string | null
          execution_time_ms: number | null
          generated_sql: string
          id: string
          intent_type: string | null
          natural_query: string
          result_count: number | null
          success: boolean
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          documents_used: string[]
          error_message?: string | null
          execution_time_ms?: number | null
          generated_sql: string
          id?: string
          intent_type?: string | null
          natural_query: string
          result_count?: number | null
          success: boolean
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          documents_used?: string[]
          error_message?: string | null
          execution_time_ms?: number | null
          generated_sql?: string
          id?: string
          intent_type?: string | null
          natural_query?: string
          result_count?: number | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      report_sections: {
        Row: {
          citations_used: string[] | null
          content: string
          created_at: string | null
          id: string
          project_id: string
          section_name: string
          section_number: number
          status: string
          updated_at: string | null
          word_count: number
        }
        Insert: {
          citations_used?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          project_id: string
          section_name: string
          section_number: number
          status?: string
          updated_at?: string | null
          word_count: number
        }
        Update: {
          citations_used?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          project_id?: string
          section_name?: string
          section_number?: number
          status?: string
          updated_at?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_projects: {
        Row: {
          citation_style: string
          content_extraction_count: number | null
          created_at: string | null
          final_report: string | null
          final_word_count: number | null
          id: string
          metadata: Json | null
          num_sources_requested: number | null
          research_type: string | null
          search_engines_used: string[] | null
          status: string
          topic: string
          updated_at: string | null
          user_id: string
          word_count_target: number
        }
        Insert: {
          citation_style?: string
          content_extraction_count?: number | null
          created_at?: string | null
          final_report?: string | null
          final_word_count?: number | null
          id?: string
          metadata?: Json | null
          num_sources_requested?: number | null
          research_type?: string | null
          search_engines_used?: string[] | null
          status: string
          topic: string
          updated_at?: string | null
          user_id: string
          word_count_target?: number
        }
        Update: {
          citation_style?: string
          content_extraction_count?: number | null
          created_at?: string | null
          final_report?: string | null
          final_word_count?: number | null
          id?: string
          metadata?: Json | null
          num_sources_requested?: number | null
          research_type?: string | null
          search_engines_used?: string[] | null
          status?: string
          topic?: string
          updated_at?: string | null
          user_id?: string
          word_count_target?: number
        }
        Relationships: []
      }
      research_sources: {
        Row: {
          authors: string[] | null
          citation_count: number | null
          citation_info: Json | null
          created_at: string | null
          credibility_score: number
          doi: string | null
          full_content: string | null
          id: string
          key_findings: string[] | null
          project_id: string
          publication_date: string | null
          source_name: string
          source_type: string
          summary: string
          title: string
          url: string
        }
        Insert: {
          authors?: string[] | null
          citation_count?: number | null
          citation_info?: Json | null
          created_at?: string | null
          credibility_score: number
          doi?: string | null
          full_content?: string | null
          id?: string
          key_findings?: string[] | null
          project_id: string
          publication_date?: string | null
          source_name: string
          source_type: string
          summary: string
          title: string
          url: string
        }
        Update: {
          authors?: string[] | null
          citation_count?: number | null
          citation_info?: Json | null
          created_at?: string | null
          credibility_score?: number
          doi?: string | null
          full_content?: string | null
          id?: string
          key_findings?: string[] | null
          project_id?: string
          publication_date?: string | null
          source_name?: string
          source_type?: string
          summary?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      research_themes: {
        Row: {
          contradictions: string[] | null
          created_at: string | null
          description: string
          evidence_strength: string | null
          id: string
          key_insights: string[] | null
          project_id: string
          supporting_sources: string[] | null
          theme_name: string
        }
        Insert: {
          contradictions?: string[] | null
          created_at?: string | null
          description: string
          evidence_strength?: string | null
          id?: string
          key_insights?: string[] | null
          project_id: string
          supporting_sources?: string[] | null
          theme_name: string
        }
        Update: {
          contradictions?: string[] | null
          created_at?: string | null
          description?: string
          evidence_strength?: string | null
          id?: string
          key_insights?: string[] | null
          project_id?: string
          supporting_sources?: string[] | null
          theme_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_themes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      search_sources: {
        Row: {
          author: string | null
          credibility_score: number | null
          domain: string | null
          id: string
          message_id: string | null
          provider: string | null
          publish_date: string | null
          research_report_id: string | null
          retrieved_at: string | null
          snippet: string | null
          title: string | null
          url: string
          user_id: string
        }
        Insert: {
          author?: string | null
          credibility_score?: number | null
          domain?: string | null
          id?: string
          message_id?: string | null
          provider?: string | null
          publish_date?: string | null
          research_report_id?: string | null
          retrieved_at?: string | null
          snippet?: string | null
          title?: string | null
          url: string
          user_id: string
        }
        Update: {
          author?: string | null
          credibility_score?: number | null
          domain?: string | null
          id?: string
          message_id?: string | null
          provider?: string | null
          publish_date?: string | null
          research_report_id?: string | null
          retrieved_at?: string | null
          snippet?: string | null
          title?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_sources_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_query_history: {
        Row: {
          connection_id: string
          created_at: string | null
          error: string | null
          execution_time_ms: number | null
          generated_sql: string
          id: string
          question: string
          row_count: number | null
          success: boolean
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          error?: string | null
          execution_time_ms?: number | null
          generated_sql: string
          id?: string
          question: string
          row_count?: number | null
          success: boolean
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          error?: string | null
          execution_time_ms?: number | null
          generated_sql?: string
          id?: string
          question?: string
          row_count?: number | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sql_query_history_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "database_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          access_count: number | null
          confidence_score: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          importance_score: number | null
          is_active: boolean | null
          last_accessed_at: string | null
          memory_type: string
          source_conversation_id: string | null
          source_message_ids: string[] | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          confidence_score?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_type: string
          source_conversation_id?: string | null
          source_message_ids?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_active?: boolean | null
          last_accessed_at?: string | null
          memory_type?: string
          source_conversation_id?: string | null
          source_message_ids?: string[] | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memories_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          default_chat_model: string | null
          default_rag_model: string | null
          default_research_depth: string | null
          default_research_model: string | null
          default_sql_model: string | null
          id: string
          monthly_budget_limit: number
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_chat_model?: string | null
          default_rag_model?: string | null
          default_research_depth?: string | null
          default_research_model?: string | null
          default_sql_model?: string | null
          id?: string
          monthly_budget_limit?: number
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_chat_model?: string | null
          default_rag_model?: string | null
          default_research_depth?: string | null
          default_research_model?: string | null
          default_sql_model?: string | null
          id?: string
          monthly_budget_limit?: number
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          budget_limit_reached: boolean | null
          budget_warning_sent: boolean | null
          created_at: string | null
          id: string
          month: string
          total_cost_usd: number
          updated_at: string | null
          usage_by_model: Json
          user_id: string
        }
        Insert: {
          budget_limit_reached?: boolean | null
          budget_warning_sent?: boolean | null
          created_at?: string | null
          id?: string
          month: string
          total_cost_usd?: number
          updated_at?: string | null
          usage_by_model?: Json
          user_id: string
        }
        Update: {
          budget_limit_reached?: boolean | null
          budget_warning_sent?: boolean | null
          created_at?: string | null
          id?: string
          month?: string
          total_cost_usd?: number
          updated_at?: string | null
          usage_by_model?: Json
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          duration: number | null
          fps: number | null
          height: number | null
          id: string
          model: string
          negative_prompt: string | null
          operation_type: string
          parameters: Json
          prompt: string
          source_url: string | null
          storage_path: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          video_url: string
          width: number | null
        }
        Insert: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          model: string
          negative_prompt?: string | null
          operation_type: string
          parameters?: Json
          prompt: string
          source_url?: string | null
          storage_path: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          video_url: string
          width?: number | null
        }
        Update: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          duration?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          model?: string
          negative_prompt?: string | null
          operation_type?: string
          parameters?: Json
          prompt?: string
          source_url?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_budget: {
        Args: { p_estimated_cost: number; p_user_id: string }
        Returns: boolean
      }
      exec_sql: { Args: { query: string }; Returns: string }
      execute_sql: { Args: { query: string }; Returns: Json[] }
      execute_tabular_query: {
        Args: { p_query: string; p_user_id: string }
        Returns: Json
      }
      get_document_schema: { Args: { p_document_id: string }; Returns: Json }
      increment_entity_mentions: {
        Args: { entity_ids: string[] }
        Returns: undefined
      }
      increment_memory_access: {
        Args: { memory_ids: string[] }
        Returns: undefined
      }
      match_documents: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
          target_user_id: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          id: string
          metadata: Json
          page_number: number
          similarity: number
        }[]
      }
      search_document: {
        Args: {
          match_count?: number
          query_embedding: string
          target_document_id: string
          target_user_id: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          metadata: Json
          relevance_score: number
          similarity_score: number
        }[]
      }
      search_documents_fulltext: {
        Args: {
          match_count: number
          match_threshold: number
          search_query: string
          target_user_id: string
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          id: string
          metadata: Json
          page_number: number
          rank: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
