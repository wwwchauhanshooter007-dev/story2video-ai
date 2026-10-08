// Story2Video AI — hosted server (Node 18+, zero dependencies).
// Serves the web app (index.html) AND the image API from one URL, so there is no CORS setup and the key never reaches the browser.
// Secrets/config come ONLY from environment variables:
//   OPENAI_API_KEY      (secret, required)  set in your host's secret/environment settings, never in code
//   ACCESS_PASSWORD     (secret, recommended) password gate for the whole site (browser login prompt, any username)
//   IMAGE_MODEL         default gpt-image-2.5-sunburst   (gpt-image-2.5-flare = faster/cheaper)
//   IMAGE_QUALITY       default medium (low|medium|high|xhigh|max|auto)
//   MAX_IMAGES_PER_HOUR default 60   (spend guard)
//   PUBLIC_URL          optional; Render's RENDER_EXTERNAL_URL is used automatically
//   MEDIA_DIR           default ./media (point at a persistent disk if you have one)
//   ALLOWED_ORIGIN      optional CORS origin (only needed if the web app is hosted elsewhere)
//   OPENAI_BASE_URL     default https://api.openai.com/v1
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const E=process.env,PORT=E.PORT||8787,KEY=E.OPENAI_API_KEY,MODEL=E.IMAGE_MODEL||'gpt-image-2.5-sunburst',QUALITY=E.IMAGE_QUALITY||'medium',
  API=E.OPENAI_BASE_URL||'https://api.openai.com/v1',PASS=E.ACCESS_PASSWORD,MAXH=+E.MAX_IMAGES_PER_HOUR||60,PUB=(E.PUBLIC_URL||E.RENDER_EXTERNAL_URL||'').replace(/\/$/,'');
const MEDIA=E.MEDIA_DIR||path.join(__dirname,'media');fs.mkdirSync(MEDIA,{recursive:true});
const cors=E.ALLOWED_ORIGIN?{'Access-Control-Allow-Origin':E.ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'POST,GET,OPTIONS'}:{};
const send=(res,code,obj)=>{res.writeHead(code,{...cors,'Content-Type':'application/json'});res.end(JSON.stringify(obj))};
const fail=(status,message,category)=>Object.assign(new Error(message),{status,category});
const cat=(st,m)=>st===401?'invalid_api_key':st===403?(/verif/i.test(m)?'organization_not_verified':'permission_denied'):st===404?'model_not_found':st===429?(/quota|billing|credit/i.test(m)?'quota_or_billing':'rate_limited'):st===400?(/safety|policy|moderation/i.test(m)?'content_policy':'invalid_request'):st>=500?'provider_outage':'provider_error';
const sha=s=>crypto.createHash('sha256').update(s).digest();
const authed=req=>{if(!PASS)return true;const m=/^Basic (.+)$/.exec(req.headers.authorization||'');if(!m)return false;return crypto.timingSafeEqual(sha(Buffer.from(m[1],'base64').toString().split(':').slice(1).join(':')),sha(PASS))};
const hits=[];const limit=()=>{const n=Date.now();while(hits.length&&n-hits[0]>36e5)hits.shift();if(hits.length>=MAXH)throw fail(429,`Hourly image limit reached (${MAXH}). Raise MAX_IMAGES_PER_HOUR or wait.`,'app_rate_limit');hits.push(n)};
async function generate(b){
  if(!KEY)throw fail(500,'OPENAI_API_KEY is not set on the server','missing_api_key');
  if(!b||typeof b.prompt!=='string'||!b.prompt.trim())throw fail(400,'prompt is required','invalid_request');
  const size=['1024x1024','1536x1024','1024x1536'].includes(b.size)?b.size:'1536x1024',h={Authorization:`Bearer ${KEY}`},refs=(Array.isArray(b.references)?b.references:[]).slice(0,10);let r;
  const files=[];for(const x of refs){let p;try{p=new URL(String(x.url),'http://x').pathname}catch(e){p=''}
    if(!p.startsWith('/media/'))throw fail(400,'reference images must be hosted by this server','invalid_request');
    const f=path.join(MEDIA,path.basename(p));if(!fs.existsSync(f))throw fail(409,`reference image for ${x.name||'a character'} is no longer on the server`,'reference_missing');files.push(f)}
  limit();
  try{if(files.length){const fd=new FormData();fd.append('model',MODEL);fd.append('prompt',b.prompt);fd.append('size',size);fd.append('quality',QUALITY);
      files.forEach(f=>fd.append('image[]',new Blob([fs.readFileSync(f)],{type:'image/png'}),path.basename(f)));
      r=await fetch(`${API}/images/edits`,{method:'POST',headers:h,body:fd})}
    else r=await fetch(`${API}/images/generations`,{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,prompt:b.prompt,size,quality:QUALITY,n:1})})}
  catch(e){throw fail(502,'Could not reach the image provider: '+(e.cause&&e.cause.code||e.message),'network')}
  const j=await r.json().catch(()=>({}));if(!r.ok){const m=(j.error&&j.error.message)||`image provider HTTP ${r.status}`;throw fail(502,`${m} [${cat(r.status,m)}, provider HTTP ${r.status}]`,cat(r.status,m))}
  const d=j.data&&j.data[0];if(!d||!d.b64_json)throw fail(502,'image provider returned no image','provider_error');
  const id=crypto.randomUUID()+'.png';fs.writeFileSync(path.join(MEDIA,id),Buffer.from(d.b64_json,'base64'));console.log(`image ok ${b.type||'scene'} refs=${files.length} model=${MODEL}`);return{url:`${PUB}/media/${id}`}}
http.createServer(async(req,res)=>{try{
  if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
  if(req.method==='GET'&&req.url==='/health')return send(res,200,{ok:true,keyConfigured:!!KEY,model:MODEL,passwordProtected:!!PASS});
  if(!authed(req)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Story2Video AI"'});return res.end('Password required')}
  if(req.method==='GET'&&(req.url==='/'||req.url.startsWith('/?')||req.url==='/index.html')){const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('<script>','<script>window.S2V_API_BASE=location.origin;</script><script>');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html)}
  if(req.method==='GET'&&req.url.startsWith('/media/')){const f=path.join(MEDIA,path.basename(req.url.split('?')[0]));if(!fs.existsSync(f))return send(res,404,{error:'not found'});res.writeHead(200,{...cors,'Content-Type':'image/png','Cache-Control':'public,max-age=31536000'});return fs.createReadStream(f).pipe(res)}
  if(req.method==='POST'&&req.url==='/api/image'){let raw='';for await(const c of req){raw+=c;if(raw.length>2e6)throw fail(413,'request too large','invalid_request')}
    let b;try{b=JSON.parse(raw)}catch(e){throw fail(400,'invalid JSON','invalid_request')}return send(res,200,await generate(b))}
  send(res,404,{error:'not found'})}catch(e){send(res,e.status||500,{error:e.message||'server error',category:e.category||'server_error'})}}).listen(PORT,()=>console.log(`Story2Video on :${PORT} model=${MODEL} key=${KEY?'set':'MISSING'} password=${PASS?'on':'OFF'} limit=${MAXH}/h`));
