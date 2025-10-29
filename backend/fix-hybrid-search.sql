-- Drop the old hybrid_search function that accepts TEXT for query_embedding
-- This causes ambiguity with the correct version that accepts VECTOR
DROP FUNCTION IF EXISTS public.hybrid_search(
  query_embedding TEXT,
  query_text TEXT,
  match_user_id UUID,
  match_count INTEGER,
  vector_weight FLOAT,
  keyword_weight FLOAT
);

-- Verify we only have the correct vector-based version
-- You should see only ONE hybrid_search function after running this
SELECT
  routine_name,
  data_type,
  parameter_name,
  ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'hybrid_search'
ORDER BY ordinal_position;
