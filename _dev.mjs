import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import http from 'http'; import fs from 'fs'; import path from 'path';
const db = await PGlite.create(); const srv = new PGLiteSocketServer({ db, port: 5545 }); await srv.start();
await db.exec(`CREATE TABLE sg_store (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at BIGINT NOT NULL DEFAULT 0, synced_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
const names=['Rahul Kumar','Amit Singh','Bablu Yadav','Sunita Devi','Deepak Shop','Ganesh Store'];
await db.query(`INSERT INTO sg_store VALUES ('sg_arcpt_01-10-2026',$1,1),('sg_rates',$2,1)`,[JSON.stringify({v:names.map((n,i)=>({no:i+1,name:n,address:i%2?'Paliganj':'Bikram',total:500*(i+1)}))}),JSON.stringify({v:{master:{a10:340,gold:800,a5:180}}})]);
const { onRequest } = await import('/home/user/webapp/functions/api/[[path]].js');
const env = { DATABASE_URL: 'postgresql://postgres@127.0.0.1:5545/postgres?sslmode=disable', SESSION_SECRET: 'x' };
http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname.startsWith('/api/')){ let b=''; for await(const ch of req) b+=ch;
    const r=await onRequest({request:new Request('http://x'+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?b:undefined}),env,params:{path:u.pathname.slice(5).split('/')}});
    res.writeHead(r.status,{'Content-Type':'application/json'}); res.end(await r.text()); return; }
  const f=path.join('/home/user/webapp',u.pathname==='/'?'index.html':u.pathname);
  try{ const d=fs.readFileSync(f); res.writeHead(200,{'Content-Type':f.endsWith('.css')?'text/css':f.endsWith('.js')?'text/javascript':'text/html'}); res.end(d);}catch(e){res.writeHead(404);res.end();}
}).listen(8788);
console.log('up');
