/**
 * Supabase Configuration
 * C4S Food Solution Payroll System
 */

const SUPABASE_URL = 'https://gbywumcfcyyxmyubhexb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXd1bWNmY3l5eG15dWJoZXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NjY2NTQsImV4cCI6MjA4MTQ0MjY1NH0.2yximJM_bm0Ue0x9okFEdMAA_aYQtDMb3jDCjaj4aeI';
// Service Role Key (KEEP SECRET - only use server-side)
// const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieXd1bWNmY3l5eG15dWJoZXhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg2NjY1NCwiZXhwIjoyMDgxNDQyNjU0fQ.fnM9yx6xQa_55PP8cLzH1sLgMAXx8iRd4wMOBr88Jok';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabase;
window.SUPABASE_URL = SUPABASE_URL;
