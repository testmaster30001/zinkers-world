// Netlify Function: fetch ZinkerRoblox public YouTube uploads without an API key.
// Classification by duration is an approximation, not YouTube's official Shorts flag.
const CHANNEL='https://www.youtube.com/@ZinkerRoblox';
const headers={'User-Agent':'Mozilla/5.0 (compatible; ZinkersWorld/1.2.1)'};
async function get(url){const r=await fetch(url,{headers,signal:AbortSignal.timeout(9500)});if(!r.ok)throw Error('YouTube response '+r.status);return r.text()}
function decode(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))}
function field(xml,name){return decode((xml.match(new RegExp('<'+name+'[^>]*>([\\s\\S]*?)</'+name+'>'))||[])[1]||'')}
exports.handler=async()=>{try{
 const page=await get(CHANNEL);
 const channel=(page.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/)||page.match(/channel_id=(UC[a-zA-Z0-9_-]+)/)||page.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/))?.[1];
 if(!channel)throw Error('Channel ID unavailable');
 const xml=await get('https://www.youtube.com/feeds/videos.xml?channel_id='+channel);
 const entries=[...xml.matchAll(/<entry>([\\s\\S]*?)<\/entry>/g)].slice(0,15);
 const videos=await Promise.all(entries.map(async m=>{const e=m[1];const id=field(e,'yt:videoId');if(!/^[\w-]{11}$/.test(id))return null;let isShort=false;try{const watch=await get('https://www.youtube.com/watch?v='+id);const seconds=watch.match(/"lengthSeconds":"(\d+)"/);if(seconds)isShort=Number(seconds[1])<=180}catch(_){}return{id,title:field(e,'title'),published:field(e,'published'),isShort}}));
 return{statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=900'},body:JSON.stringify({videos:videos.filter(Boolean)})};
 }catch(e){return{statusCode:503,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'YouTube feed unavailable'})}}};
