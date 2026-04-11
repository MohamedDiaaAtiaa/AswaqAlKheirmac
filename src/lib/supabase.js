import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kymguooufnfewrnoaqhw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWd1b291Zm5mZXdybm9hcWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTIyMzAsImV4cCI6MjA5MTMyODIzMH0.zMwIIENekDTzCB2C2fUb-BSTSwzKC1bLra_uTTYTmis'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
