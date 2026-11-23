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
    'Illustration': {
      'Wed, 09.41': 'Aditya Hanum Widarsa S.Ds., M.Sn.',
      'Thu, 07.51': 'Riri Trinanda S.Pd., M.Sn.'
    },
    'Photography': {
      'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.',
      'Mon, 07.51': 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.'
    },
    'Advertising Photography': {
      'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.'
    },
    'Applied Typography': {
      'Tue, 13.20': 'Hendra afriwan, S.Sn, M.Sn',
      'Mon, 07.51': 'Arif Budiman, M.Kom',
      'Tue, 7.51': 'Arif Budiman, M.Kom.'
    },
    'Ilustrasi Desain': {
      'Wed, 09.41': 'Aditya Hanum Widarsa S.Ds., M.Sn.',
      'Thu, 07.51': 'Riri Trinanda S.Pd., M.Sn.'
    },
    'Fotografi Iklan': {
      'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.',
      'Mon, 07.51': 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.'
    },
    'Tipografi Aplikatif': {
      'Tue, 13.20': 'Hendra afriwan, S.Sn, M.Sn',
      'Mon, 07.51': 'Arif Budiman, M.Kom',
      'Tue, 7.51': 'Arif Budiman, M.Kom.'
    }
  }
};
