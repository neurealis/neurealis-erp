// Run migration on neurealis ERP (mfpuijttdgkllnvhvjlu)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mfpuijttdgkllnvhvjlu.supabase.co',
  'sb_secret_e_lDSTdW_5mBvKMbMokM5w_DxXuERF5'
);

async function main() {
  // Check existing triggers
  const { data, error } = await supabase.rpc('get_mangel_triggers');

  if (error) {
    console.log('RPC not available, checking via REST...');

    // List notifications
    const { data: notifs } = await supabase
      .from('mangel_notifications')
      .select('*')
      .limit(5);

    console.log('Notifications:', notifs);
  } else {
    console.log('Triggers:', data);
  }
}

main().catch(console.error);
