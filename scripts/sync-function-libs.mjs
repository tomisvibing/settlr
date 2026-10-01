// The push Edge Function reuses the app's money maths and overview sentence. Supabase deploys a
// function's own folder, so it keeps copies of those files; run `npm run sync-functions` after
// changing them (test/function-libs.test.js fails until you do).
import { copyFileSync } from 'node:fs';

export const SHARED = ['ledger.js', 'story.js', 'format.js'];
if(import.meta.url === `file://${process.argv[1]}`){
  for(const f of SHARED) copyFileSync(`src/lib/${f}`, `supabase/functions/push/lib/${f}`);
  console.log(`Copied ${SHARED.join(', ')} into supabase/functions/push/lib/`);
}
