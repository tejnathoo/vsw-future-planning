// Minimal static file server, routed by path so the domain root stays free
// for whatever twelveoclock.co ends up being used for later.
// Zero dependencies on purpose: this is a separate Railway service from the
// Slack intake bot, and it should have nothing in its build that could fail
// or need updating independently of that service.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || 3000;
const PAGE = fs.readFileSync(path.join(__dirname, "index.html"));

const ROOT_PLACEHOLDER = `<!doctype html><meta charset="utf-8">
<title>twelveoclock.co</title>
<body style="font-family: system-ui, sans-serif; background: #0F1013; color: #ECEDF0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
<p>Nothing here yet.</p>
</body>`;

function normalize(p) {
  return p.replace(/\/+$/, "") || "/";
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = normalize(url.pathname);

  if (route === "/vsw-week-plan") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }

  if (route === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(ROOT_PLACEHOLDER);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`serving / and /vsw-week-plan on :${PORT}`);
});
