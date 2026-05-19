import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ezcfulijxtfglpfarxtl.supabase.co'
// Using service role key for desktop demo (bypasses RLS since auth is skipped)
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2Z1bGlqeHRmZ2xwZmFyeHRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQwOTA3NiwiZXhwIjoyMDkxOTg1MDc2fQ.mga0jrv0DaGO6sPNcN8XsvOqGYSuPICjpTVGWHXbWoQ'

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
