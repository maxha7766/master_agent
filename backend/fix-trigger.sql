-- Drop the trigger that's causing the error
-- This trigger tries to set updated_at column which doesn't exist
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;

-- Drop the function too since we're not using it
DROP FUNCTION IF EXISTS update_updated_at_column();
