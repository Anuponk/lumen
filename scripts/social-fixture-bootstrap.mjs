// Disposable schema baseline only. The frozen 20261004 export uses single '$'
// body delimiters; normalize those delimiters in memory for PostgreSQL execution.
// Never rewrite an applied migration or install this fixture in production.
import fs from 'node:fs';
let source=fs.readFileSync('supabase/migrations/20261004_lumen_social_challenges.sql','utf8');
source=source.replace(/as \$\r?\n/g,()=> 'as $$\n').replace(/end \$;/g,()=> 'end $$;').replace(/^\$;/gm,()=> '$$;');
process.stdout.write('create table public.lumen_push_subscriptions(id uuid primary key,enabled boolean default true);\n'+source+'\n'+
 fs.readFileSync('supabase/migrations/20261007_lumen_social_challenge_dynamic_catalog.sql','utf8'));
