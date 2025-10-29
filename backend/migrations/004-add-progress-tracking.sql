-- Add progress tracking to documents table

-- Add progress column (JSON object with step info)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS processing_progress JSONB DEFAULT '{"step": "pending", "percent": 0, "message": "Waiting to process"}'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS documents_status_progress_idx
  ON public.documents(status, processing_progress);

COMMENT ON COLUMN public.documents.processing_progress IS 'Processing progress tracking: {step: string, percent: number, message: string}';
