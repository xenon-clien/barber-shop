import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vyyoapdwhzubklstljhl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5eW9hcGR3aHp1Ymtsc3RsamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDk2NTYsImV4cCI6MjA5ODk4NTY1Nn0.1YApz6Ol4UTUQ6Rb8o4pTr1fsoa9RSS_isYGmuK7YUE';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSignup() {
  console.log('Attempting signup...');
  const { data, error } = await sb.auth.signUp({
    email: 'test_user_' + Date.now() + '@example.com',
    password: 'password123',
    options: { data: { name: 'Test User' } }
  });
  
  if (error) {
    console.error('Signup Error:', error);
  } else {
    console.log('Signup Success:', data.user?.id);
    
    // Check if trigger worked
    const { data: profile, error: profileErr } = await sb.from('users').select('*').eq('id', data.user.id).single();
    if (profileErr) {
      console.error('Trigger/Profile Error:', profileErr);
    } else {
      console.log('Profile created successfully:', profile);
    }
  }
}

testSignup();
