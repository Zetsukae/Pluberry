const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase: SUPABASE_URL or SUPABASE_ANON_KEY not set in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
  },
});

async function signInWithGitHub() {
  try {
    console.log('[2] Starting GitHub OAuth...');
    const result = await supabase.auth.signInWithOAuth({ 
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    console.log('[-] GitHub OAuth result:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('{X} GitHub OAuth error:', err);
    return { error: err };
  }
}

async function signInWithDiscord() {
  try {
    console.log('[2] Starting Discord OAuth...');
    const result = await supabase.auth.signInWithOAuth({ 
      provider: 'discord',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    console.log('[-] Discord OAuth result:', JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.error('{X} Discord OAuth error:', err);
    return { error: err };
  }
}

async function signOut() {
  return await supabase.auth.signOut();
}

async function getUser() {
  return await supabase.auth.getUser();
}

async function isUserLoggedIn() {
  const user = await supabase.auth.getUser();
  return user?.data?.user ? true : false;
}

function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

// Sources CRUD
async function saveSource(userId, source) {
  if (!userId) return { error: new Error('No userId provided') };
  
  // Check if user is logged in (OAuth doesn't require email verification)
  const loggedIn = await isUserLoggedIn();
  if (!loggedIn) {
    return { error: new Error('Please log in to save sources') };
  }

  if (source.id) {
    const { data, error } = await supabase
      .from('sources')
      .update({ name: source.name || null, data: source })
      .eq('id', source.id)
      .eq('user_id', userId)
      .select();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from('sources')
      .insert([{ user_id: userId, name: source.name || null, data: source }])
      .select();
    return { data, error };
  }
}

async function loadSources(userId) {
  if (!userId) return { error: new Error('No userId provided') };
  const { data, error } = await supabase.from('sources').select('*').eq('user_id', userId);
  return { data, error };
}

module.exports = {
  supabase,
  signInWithGitHub,
  signInWithDiscord,
  signOut,
  getUser,
  isUserLoggedIn,
  onAuthStateChange,
  saveSource,
  loadSources,
};
