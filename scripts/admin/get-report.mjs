import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get the most recent completed project
const { data: project } = await supabase
  .from('research_projects')
  .select('*')
  .eq('status', 'complete')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (project && project.final_report) {
  console.log(project.final_report);
} else {
  console.log('No completed project found');
}
