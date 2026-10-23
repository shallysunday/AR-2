// Shared-archive settings.
// Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in "this device only" mode.
// Both values are safe to publish: access is limited by the policies in supabase-setup.sql.
window.ARCHIVE_CONFIG = {
  SUPABASE_URL: 'https://oyxmyumsqbwnsdpgfoqe.supabase.co',        // e.g. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eG15dW1zcWJ3bnNkcGdmb3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTI0MjAsImV4cCI6MjEwODMyODQyMH0.4nIadjGWKgV81y12GN7PWsYwVAu-l2Xctto92d_nv4k',   // Project Settings → API → anon / publishable key
  SHOW_SAMPLES: true       // set to false once you have real artworks
};
