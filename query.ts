import { supabase } from './supabaseClient';

async function test() {
  const { data: g1 } = await supabase.from('app_settings').select('data').eq('id', 1).maybeSingle();
  const { data: g11 } = await supabase.from('app_settings').select('data').eq('id', 11).maybeSingle();

  console.log('Grade 1 data keys/nodes count:', g1?.data?.nodes?.length || 0);
  console.log('Grade 11 data keys/nodes count:', g11?.data?.nodes?.length || 0);

  if (g1?.data?.nodes) {
    console.log('Sample nodes from Grade 1:', g1.data.nodes.slice(0, 5));
  }
  if (g11?.data?.nodes) {
    console.log('Sample nodes from Grade 11:', g11.data.nodes.slice(0, 5));
  }
}

test();
