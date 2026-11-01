// Node.js HTTP adapter for the private deletion handler.
// Mount only on a trusted backend; never on the static site or a public
// serverless runtime with PostgreSQL owner credentials.
export function createNodeDeletionRoute({handle,maxBodyBytes=1024}) {
  if(typeof handle!=='function'||!Number.isSafeInteger(maxBodyBytes)||maxBodyBytes<64||maxBodyBytes>65536)throw Error('Invalid private route configuration');
  return async function route(req,res) {
    const reply=(status,body)=>{
      res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
      res.end(JSON.stringify(body));
    };
    if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
    const type=req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if(type!=='application/json')return reply(415,{error:'unsupported_media_type'});
    if(req.headers.origin) {
      // Browser requests must originate from the exact configured site.
      const allowedOrigin=process.env.LUMEN_PUBLIC_ORIGIN;
      if(!allowedOrigin||req.headers.origin!==allowedOrigin)return reply(403,{error:'forbidden_origin'});
    }
    let body='',bytes=0;
    try {
      for await(const chunk of req) {
        bytes+=Buffer.byteLength(chunk);
        if(bytes>maxBodyBytes)return reply(413,{error:'request_too_large'});
        body+=chunk.toString('utf8');
      }
      const response=await handle({method:req.method,headers:req.headers,body});
      res.writeHead(response.status,{...response.headers,'x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
      res.end(response.body);
    }catch {
      if(!res.headersSent)reply(503,{error:'temporarily_unavailable'});
      else res.end();
    }
  };
}
