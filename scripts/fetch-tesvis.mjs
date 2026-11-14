// Fixed public transport, not an arbitrary URL or authenticated proxy.
const url=new URL(process.argv[2]);
const allowed=url.hostname==='modis.ornl.gov'&&url.pathname.startsWith('/rst/api/v1/')||url.hostname==='cmr.earthdata.nasa.gov'&&url.pathname==='/search/granules.json'||url.hostname==='api.gbif.org'&&['/v1/species/match','/v1/occurrence/search'].includes(url.pathname);
if(url.protocol!=='https:'||!allowed||url.username||url.password||url.port)throw new Error('Public NASA data/metadata route denied.');
const response=await fetch(url,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(60000)});
if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw new Error('TESViS did not return a successful JSON response.');
let length=0;const chunks=[];
for await(const chunk of response.body){length+=chunk.length;if(length>48*1024*1024)throw new Error('Response budget exceeded.');chunks.push(chunk);}
process.stdout.write(Buffer.concat(chunks));
