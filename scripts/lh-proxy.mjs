/**
 * Local stand-in for the CDN in front of Netlify: proxies :3001 -> :3000 and
 * gzips every text response, so Lighthouse measures the bytes a real user gets.
 *
 *   node scripts/lh-proxy.mjs            (then run Lighthouse against http://localhost:3001)
 */
import http from "node:http";
import zlib from "node:zlib";

const UPSTREAM = process.env.UPSTREAM ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? 3001);
const TEXT = /^(text\/|application\/(javascript|json|xml|rss\+xml|x-javascript)|image\/svg)/i;

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", UPSTREAM);
    if (process.env.LOG_HEADERS) console.log(req.method, url.pathname, "AE=", req.headers["accept-encoding"], "UA=", String(req.headers["user-agent"] ?? "").slice(0, 40));
    const headers = { ...req.headers, host: url.host, "accept-encoding": "identity" };
    const up = http.request(url, { method: req.method, headers }, (u) => {
      const ct = String(u.headers["content-type"] ?? "");
      const wantsGzip = /gzip/.test(String(req.headers["accept-encoding"] ?? ""));
      const h = { ...u.headers };
      delete h["content-length"];
      delete h["transfer-encoding"];
      if (wantsGzip && TEXT.test(ct)) {
        h["content-encoding"] = "gzip";
        h["vary"] = "Accept-Encoding";
        res.writeHead(u.statusCode ?? 200, h);
        u.pipe(zlib.createGzip({ level: 6 })).pipe(res);
      } else {
        res.writeHead(u.statusCode ?? 200, h);
        u.pipe(res);
      }
    });
    up.on("error", (e) => {
      res.writeHead(502);
      res.end(String(e));
    });
    req.pipe(up);
  })
  .listen(PORT, () => console.log(`lh-proxy: http://localhost:${PORT} -> ${UPSTREAM} (gzip)`));
