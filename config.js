// Shared-archive settings.
// Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in "this device only" mode.
// Both values are safe to publish: access is limited by the policies in supabase-setup.sql.
window.ARCHIVE_CONFIG = {
  SUPABASE_URL: 'https://oyxmyumsqbwnsdpgfoqe.supabase.co',        // e.g. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_yAb5GGtmO-85AIpTbFJhgg_3BUgFuOb',   // Project Settings → API → anon / publishable key
  SHOW_SAMPLES: true,      // set to false once you have real artworks

  /* ==========================================================
     CLASS & LECTURER CONFIGURATION
     ----------------------------------------------------------
     Assign or update your lecturers and class codes here:
     Format:
       'Class Name': {
         'CLASS_CODE': 'Lecturer Name'
       }
     ========================================================== */
  CLASS_CATALOG: {
    'Ilustrasi Desain': {
      'IL101': 'Dosen A',
      'IL102': 'Dosen B',
      'IL103': 'Dosen C'
    },
    'Fotografi Iklan': {
      'AP201': 'Dosen D',
      'AP202': 'Dosen E',
      'AP203': 'Dosen F'
    },
    'Tipografi Aplikatif': {
      'AT201': 'Dosen G',
      'AT202': 'Dosen H',
      'AT203': 'Dosen I'
    }
  }
};
