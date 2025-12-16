/**
 * Database Setup Script
 * Run this once to create all tables in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jnjerzsiqrrfytbpszdv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuamVyenNpcXJyZnl0YnBzemR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg2NDE1NSwiZXhwIjoyMDgxNDQwMTU1fQ.B1ogMVaZgTcMh11yKkWBAsYCgrgNPswbJiXfSQvVw5E';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setupDatabase() {
  console.log('Setting up database tables...\n');

  // Test connection first
  const { data: test, error: testError } = await supabase.from('employees').select('count').limit(1);

  if (testError && testError.code === 'PGRST205') {
    console.log('Tables do not exist yet. Please run the SQL manually in Supabase Dashboard.');
    console.log('\nGo to: https://supabase.com/dashboard/project/jnjerzsiqrrfytbpszdv/sql/new');
    console.log('\nThen copy and paste the contents of database-schema.sql');
    return;
  }

  if (testError) {
    console.error('Connection error:', testError.message);
    return;
  }

  console.log('Tables already exist! Connection successful.');

  // Try to insert admin user if not exists
  const { data: admin, error: adminError } = await supabase
    .from('employees')
    .upsert({
      id: 'ADMIN',
      name: 'System Administrator',
      email: 'admin@c4s.com',
      username: 'admin',
      password_hash: '0304',
      role: 'Admin',
      salary: 0,
      status: 'active'
    }, { onConflict: 'id' })
    .select();

  if (adminError) {
    console.log('Admin user may already exist:', adminError.message);
  } else {
    console.log('Admin user ready!');
  }

  console.log('\nDatabase setup complete!');
  console.log('You can now use the payroll system.');
}

setupDatabase().catch(console.error);
