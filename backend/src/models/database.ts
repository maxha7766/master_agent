import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Supabase client singleton for backend operations
 * Uses service role key for admin access (bypasses RLS when needed)
 */
class DatabaseClient {
  private static instance: SupabaseClient | null = null;

  private constructor() {}

  public static getInstance(): SupabaseClient {
    if (!DatabaseClient.instance) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(
          'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
        );
      }

      DatabaseClient.instance = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    return DatabaseClient.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    DatabaseClient.instance = null;
  }
}

export const supabase = DatabaseClient.getInstance();
export default DatabaseClient;
