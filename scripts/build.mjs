import {writeFileSync} from 'node:fs';
for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY']) if(!process.env[key]) throw Error(`Missing ${key}`);
writeFileSync('public/config.js',`export default ${JSON.stringify({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY})};\n`);
console.log('Static application configured. No React dependencies.');
