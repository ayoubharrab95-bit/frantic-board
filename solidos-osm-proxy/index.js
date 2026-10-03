const http = require("http");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.PORT || 10000);
const ENDPOINTS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
];

function json(res, status, body) {
  res.writeHead(status, {"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  res.end(JSON.stringify(body));
}

async function tryOverpass(endpoint, query) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const body = "data=" + encodeURIComponent(query);
    const r = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "user-agent": "BookedSolidResearchBot/1.0 (+https://www.bookedsolidcopy.com/)",
        "accept": "application/json",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    const ok = r.ok && data && Array.isArray(data.elements);
    return {
      ok,
      endpoint,
      status: r.status,
      latency_ms: Date.now() - started,
      result_count: ok ? data.elements.length : null,
      error: ok ? null : text.slice(0, 300)
    };
  } catch (e) {
    return {
      ok:false, endpoint, status:0, latency_ms:Date.now()-started,
      error:String(e && e.message || e),
      cause:e && e.cause ? {
        message:String(e.cause.message||""),
        code:e.cause.code||null,
        errno:e.cause.errno||null,
        syscall:e.cause.syscall||null,
        address:e.cause.address||null,
        port:e.cause.port||null
      } : null
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probe() {
  const query = '[out:json][timeout:5];node(around:100,33.4484,-112.0740)["shop"];out tags 1;';
  const attempts = [];
  for (const endpoint of ENDPOINTS) {
    const a = await tryOverpass(endpoint, query);
    attempts.push(a);
    if (a.ok) return {ok:true, selected_endpoint:endpoint, attempts};
  }
  return {ok:false, selected_endpoint:null, attempts};
}


async function probePostpass() {
  const sql = `
    SELECT osm_id, osm_type, tags, geom
    FROM postpass_pointpolygon
    WHERE geom && ST_MakeEnvelope(-112.20,33.35,-111.95,33.60,4326)
      AND (
        tags @> '{"craft":"roofer"}'::jsonb
        OR tags @> '{"office":"construction_company"}'::jsonb
      )
    LIMIT 5
  `;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch("https://postpass.geofabrik.de/api/interpreter", {
      method:"POST",
      signal:controller.signal,
      headers:{
        "user-agent":"BookedSolidResearchBot/1.0 (+https://www.bookedsolidcopy.com/)",
        "accept":"application/json",
        "content-type":"application/x-www-form-urlencoded;charset=UTF-8"
      },
      body:"data="+encodeURIComponent(sql)
    });
    const text=await r.text();
    let data=null; try{data=JSON.parse(text)}catch{}
    return {
      ok:r.ok && data!==null,
      status:r.status,
      latency_ms:Date.now()-started,
      feature_count:Array.isArray(data?.features)?data.features.length:null,
      type:data?.type||null,
      error:r.ok?null:text.slice(0,500)
    };
  } catch(e) {
    return {
      ok:false,status:0,latency_ms:Date.now()-started,error:String(e?.message||e),
      cause:e?.cause?{message:String(e.cause.message||""),code:e.cause.code||null}:null
    };
  } finally { clearTimeout(timer); }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") return json(res, 200, {ok:true, service:"solidos-osm-proxy", version:1});
    if (req.url === "/probe") {
      const result = await probe();
      return json(res, result.ok ? 200 : 503, result);
    }
    if (req.url === "/probe-postpass") {
      const result = await probePostpass();
      return json(res, result.ok ? 200 : 503, result);
    }
    return json(res, 404, {ok:false,error:"not_found",routes:["/health","/probe"]});
  } catch (e) {
    return json(res, 500, {ok:false,error:String(e && e.message || e)});
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("solidos-osm-proxy listening", {PORT});
});

setTimeout(() => {
  probe().then(r => console.log("startup_probe", JSON.stringify(r)))
    .catch(e => console.error("startup_probe_error", e));
  probePostpass().then(r => console.log("startup_postpass_probe", JSON.stringify(r)))
    .catch(e => console.error("startup_postpass_probe_error", e));
}, 1000);
