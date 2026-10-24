// Zinker's World: Netlify YouTube feed function (diagnostic update).
// No API key required. Shorts classification by duration is approximate.
const CHANNEL_URL = 'https://www.youtube.com/@ZinkerRoblox';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' };
const reply = (statusCode, data) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120, s-maxage=300' }, body: JSON.stringify(data) });
async function get(url, stage) {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`${stage}: HTTP ${response.status}`);
  return response.text();
}
function decode(s='') { return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)); }
function field(xml,name) { const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return decode((xml.match(new RegExp('<'+escaped+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+escaped+'>'))||[])[1]||''); }
function findChannelId(html) {
  const patterns = [ /"channelId"\s*:\s*"(UC[\w-]{22})"/, /"externalId"\s*:\s*"(UC[\w-]{22})"/, /"browseId"\s*:\s*"(UC[\w-]{22})"/, /channel_id=(UC[\w-]{22})/, /youtube\.com\/channel\/(UC[\w-]{22})/ ];
  for (const pattern of patterns) { const match=html.match(pattern); if(match) return match[1]; }
  return null;
}
exports.handler = async () => {
  try {
    console.log('[Zinker TV] Starting YouTube channel lookup');
    const page=await get(CHANNEL_URL,'channel page');
    const channelId=findChannelId(page);
    if(!channelId) throw new Error('channel lookup: channel ID not found in YouTube HTML');
    console.log('[Zinker TV] Channel ID resolved; requesting RSS feed');
    const xml=await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,'RSS feed');
    if(!xml.includes('<feed') && !xml.includes('<entry')) throw new Error('RSS feed: response was not Atom XML');
    const entries=[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].slice(0,15);
    console.log(`[Zinker TV] RSS feed returned ${entries.length} entries`);
    const videos=await Promise.all(entries.map(async (match) => {
      const entry=match[1], id=field(entry,'yt:videoId');
      if(!/^[\w-]{11}$/.test(id)) return null;
      let isShort=false;
      try {
        const watch=await get(`https://www.youtube.com/watch?v=${id}`,'video page');
        const seconds=watch.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/);
        if(seconds) isShort=Number(seconds[1])<=180;
      } catch(error) { console.warn(`[Zinker TV] Could not determine duration for ${id}: ${error.message}`); }
      return {id,title:field(entry,'title'),published:field(entry,'published'),isShort};
    }));
    return reply(200,{videos:videos.filter(Boolean)});
  } catch(error) {
    console.error('[Zinker TV] Feed error:',error && error.stack ? error.stack : String(error));
    return reply(503,{error:'YouTube feed unavailable',hint:'Check Netlify function logs for [Zinker TV] Feed error'});
  }
};
