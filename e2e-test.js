// OPTIONAL command-line version of the real test (the same test can be done by clicking in the hosted app).
//   BASE=https://your-app.onrender.com ACCESS_PASSWORD=yourpassword node e2e-test.js
// Flow = exactly what the app does: 3 character portraits from Bible text -> 1 scene image conditioned on all 3 portraits.
const fs=require('fs'),BASE=(process.env.BASE||'http://localhost:8787').replace(/\/$/,'');
const AUTH=process.env.ACCESS_PASSWORD?{Authorization:'Basic '+Buffer.from('user:'+process.env.ACCESS_PASSWORD).toString('base64')}:{};
const style='cinematic, warm film grain, Pixar-quality 3D realism';
const bible=[ // fixed test profiles for this story (the app builds these with AI)
 {name:'Kaashi',d:'8-year-old girl; face: round face; skin: wheatish; hair: two short pigtails; eyes: brown; small build; wearing a yellow frock; red sandals; permanent identity: gap in front teeth'},
 {name:'Vrinda',d:'6-year-old girl; face: heart-shaped face; skin: fair; hair: bob cut with fringe; eyes: dark; tiny build; wearing a green kurta; blue hairclip; permanent identity: dimple on right cheek'},
 {name:'Nani',d:'70-year-old woman; face: soft wrinkles; skin: brown; hair: silver bun; eyes: warm brown; plump build; wearing a maroon cotton saree; glass bangles; permanent identity: red bindi'}];
const post=async b=>{let r;try{r=await fetch(BASE+'/api/image',{method:'POST',headers:{'Content-Type':'application/json',...AUTH},body:JSON.stringify(b)})}catch(e){throw{category:'backend_unreachable',error:`Cannot reach ${BASE} — is the server running?`}}
 const j=await r.json().catch(()=>({}));if(r.status===401)throw{category:'wrong_access_password',error:'Set ACCESS_PASSWORD to the site password'};if(!r.ok)throw{category:j.category||'unknown',error:j.error||'HTTP '+r.status};return j};
(async()=>{try{
 const h=await (await fetch(BASE+'/health').catch(()=>{throw{category:'backend_unreachable',error:`Cannot reach ${BASE}`}})).json();
 console.log('server:',JSON.stringify(h));if(!h.keyConfigured)throw{category:'missing_api_key',error:'OPENAI_API_KEY is not set in the server environment'};
 fs.mkdirSync('e2e-out',{recursive:true});const refs=[];
 for(const c of bible){console.log('portrait',c.name,'…');const r=await post({type:'character_reference',size:'1024x1024',references:[],prompt:`Character reference sheet, ${style}. Single character, front-facing, full body, neutral standing pose, plain light-grey studio background, no text.\n${c.name} (${c.d})`});refs.push({name:c.name,url:r.url});console.log('  ok',r.url)}
 console.log('scene …');const scene=await post({type:'scene',size:'1536x1024',references:refs,prompt:`${style}. Medium wide shot. Sunlit courtyard of an Indian home, noon. Action: Nani calls Kaashi and Vrinda for lunch from the veranda; the girls run toward her laughing.\nCharacters (keep identical across all scenes): ${bible.map(c=>`${c.name} (${c.d})`).join(' | ')}\nReference images are attached in this order: ${refs.map(r=>r.name).join(', ')}. Each named character MUST match their reference image exactly; do not redesign any character.`});
 const buf=Buffer.from(await (await fetch(scene.url.startsWith('http')?scene.url:BASE+scene.url,{headers:AUTH})).arrayBuffer());const png=buf.slice(0,8).toString('hex')==='89504e470d0a1a0a';
 fs.writeFileSync('e2e-out/scene.png',buf);console.log(png&&buf.length>10000?`PASS — real scene image saved: e2e-out/scene.png (${buf.length} bytes)`:`FAIL — returned file is not a valid image (${buf.length} bytes)`)}
catch(e){console.log(`FAIL — category: ${e.category||'unknown'}\n  detail: ${e.error||e.message||e}`);process.exitCode=1}})();
