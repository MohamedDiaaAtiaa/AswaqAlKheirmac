import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kymguooufnfewrnoaqhw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWd1b291Zm5mZXdybm9hcWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTIyMzAsImV4cCI6MjA5MTMyODIzMH0.zMwIIENekDTzCB2C2fUb-BSTSwzKC1bLra_uTTYTmis'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@admin.com',
    password: 'adminpassword123'
  })

  if (error) {
    console.log('Login failed:', error.message)
    // trying without login
  } else {
    console.log('Logged in!')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .single()

    console.log('Profile:', profile)
    console.log('Profile Error:', profileError)
  }
}

test()
