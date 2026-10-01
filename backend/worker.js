import {validateRecord,STAT_KEYS} from '../src/core/ranking.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
const publicScore=row=>row?{player:row.player,character:row.character,level:row.level,total:row.total,splits:JSON.parse(row.splits),stats:JSON.parse(row.stats),version:row.version}:null;
async function account(request,env){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';if(!/^[a-f0-9]{64}$/.test(token))return null;return env.DB.prepare('SELECT uid FROM sessions WHERE token_hash = ?').bind(await digest(token)).first();}
async function limited(request,env,kind,limit){const hour=Math.floor(Date.now()/3600000);const ip=request.headers.get('CF-Connecting-IP')||'local';const bucket=await digest(`${ip}:${hour}:${kind}`);const row=await env.DB.prepare('INSERT INTO rate_limits(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,(hour+2)*3600000).first();await env.DB.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(Date.now()).run();return row.count>limit;}
async function handle(request,env){
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  if(request.method==='GET'&&path==='/health')return json({ok:true});
  if(request.method==='POST'&&path==='/session'){
    if(await limited(request,env,'session',30))return json({error:'しばらく待ってから再試行してください'},429);
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),uid=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO sessions(uid,token_hash,created_at) VALUES(?,?,?)').bind(uid,await digest(token),Date.now()).run();return json({token},201);
  }
  if(request.method==='GET'&&path==='/scores'){
    const result=await env.DB.prepare('SELECT * FROM scores WHERE flagged=0 ORDER BY total ASC, uid ASC LIMIT 100').all();
    return json({scores:result.results.map(publicScore)});
  }
  if(path==='/me'||path==='/scores'){
    const user=await account(request,env);if(!user)return json({error:'ランキングの認証に失敗しました'},401);
    if(request.method==='GET'&&path==='/me'){
      const own=await env.DB.prepare('SELECT * FROM scores WHERE uid=? AND flagged=0').bind(user.uid).first();
      const count=own?await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE flagged=0 AND total < ?').bind(own.total).first():null;
      return json({score:publicScore(own),rank:count?count.n+1:null});
    }
    if(request.method==='POST'&&path==='/scores'){
      if(await limited(request,env,`score:${user.uid}`,30))return json({error:'登録間隔を空けてください'},429);
      if(Number(request.headers.get('Content-Length'))>500000)return json({error:'データが大きすぎます'},413);
      const text=await request.text();if(text.length>500000)return json({error:'データが大きすぎます'},413);
      let record;try{record=JSON.parse(text);}catch{return json({error:'JSONが不正です'},400);}
      const errors=validateRecord(record);if(errors.length)return json({error:errors.join(' / ')},422);
      const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,record.stats[k]]));
      await env.DB.prepare('INSERT INTO scores(uid,player,character,level,total,splits,stats,shape_hash,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET player=excluded.player,character=excluded.character,level=excluded.level,total=excluded.total,splits=excluded.splits,stats=excluded.stats,shape_hash=excluded.shape_hash,version=excluded.version,updated_at=excluded.updated_at WHERE excluded.total < scores.total').bind(user.uid,record.player.trim(),record.character.trim(),record.level,record.total,JSON.stringify(record.splits),JSON.stringify(stats),await digest(JSON.stringify(record.drawing)),record.version,Date.now()).run();
      return json({ok:true});
    }
  }
  return json({error:'Not found'},404);
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
  if(origin&&!allowed.includes(origin))return json({error:'Origin not allowed'},403);
  let response;
  if(request.method==='OPTIONS')response=new Response(null,{status:204});
  else {try{response=await handle(request,env);}catch(error){console.error('ranking backend failure',error.name);response=json({error:'ランキングが一時的に利用できません'},503);}}
  if(origin)response.headers.set('Access-Control-Allow-Origin',origin);
  response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');return response;
}};
