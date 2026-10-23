// One-time Zoho Inventory login for local development.
// Opens a local page where you paste the Zoho API client ID/secret, then runs the
// OAuth consent flow in your browser and saves a refresh token OUTSIDE the repo:
//   ~/.freshroots/zoho.json  (never commit this file)
import http from "node:http";
import { exec } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "ZohoInventory.purchaseorders.ALL",
  "ZohoInventory.contacts.ALL",
  "ZohoInventory.items.ALL",
  "ZohoInventory.settings.READ",
].join(",");
const OUT_DIR = join(homedir(), ".freshroots");
const OUT_FILE = join(OUT_DIR, "zoho.json");

let pending = null; // { clientId, clientSecret, dc, state }

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f6fb;color:#14213d;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#fff;padding:32px;border-radius:14px;box-shadow:0 8px 30px #0001;width:min(520px,92vw)}
h1{font-size:20px;margin:0 0 6px}p{color:#4a5672;font-size:14px;line-height:1.5}label{display:block;font-size:13px;font-weight:600;margin:14px 0 4px}
input,select{width:100%;padding:10px;border:1px solid #cdd3e0;border-radius:8px;font-size:14px;box-sizing:border-box}
button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:8px;background:#2453d4;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
code{background:#eef1f8;padding:2px 6px;border-radius:4px}.ok{color:#137a43}.err{color:#b42318}</style></head>
<body><div class="card">${body}</div></body></html>`;

const formPage = page("Zoho login", `
<h1>Connect Zoho Inventory</h1>
<p>In the Zoho API Console create a <b>Server-based Application</b> client with:<br>
Homepage URL <code>http://localhost:${PORT}</code><br>Redirect URI <code>${REDIRECT_URI}</code></p>
<form method="post" action="/start">
<label>Data centre</label>
<select name="dc"><option value="in">India (zoho.in)</option><option value="com">US (zoho.com)</option><option value="eu">EU (zoho.eu)</option></select>
<label>Client ID</label><input name="clientId" required autocomplete="off">
<label>Client Secret</label><input name="clientSecret" type="password" required autocomplete="off">
<button>Continue to Zoho login</button></form>`);

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(new URLSearchParams(data)));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (status, html) => {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  };

  try {
    if (req.method === "GET" && url.pathname === "/") return send(200, formPage);

    if (req.method === "POST" && url.pathname === "/start") {
      const body = await readBody(req);
      const dc = ["in", "com", "eu"].includes(body.get("dc")) ? body.get("dc") : "in";
      pending = {
        clientId: body.get("clientId").trim(),
        clientSecret: body.get("clientSecret").trim(),
        dc,
        state: crypto.randomUUID(),
      };
      const auth = new URL(`https://accounts.zoho.${dc}/oauth/v2/auth`);
      auth.search = new URLSearchParams({
        scope: SCOPES,
        client_id: pending.clientId,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        redirect_uri: REDIRECT_URI,
        state: pending.state,
      });
      res.writeHead(302, { Location: auth.toString() });
      return res.end();
    }

    if (url.pathname === "/callback") {
      if (!pending || url.searchParams.get("state") !== pending.state) {
        return send(400, page("Error", `<h1 class="err">Login session mismatch</h1><p>Start again at <a href="/">localhost:${PORT}</a>.</p>`));
      }
      const code = url.searchParams.get("code");
      if (!code) {
        return send(400, page("Error", `<h1 class="err">Zoho did not return a code</h1><p>${url.searchParams.get("error") ?? "Access denied"}</p>`));
      }
      // Zoho tells us which accounts server owns this user; only trust zoho.* hosts.
      let accounts = url.searchParams.get("accounts-server") || `https://accounts.zoho.${pending.dc}`;
      if (!/^https:\/\/accounts\.zoho\.[a-z.]+$/.test(accounts)) accounts = `https://accounts.zoho.${pending.dc}`;

      const tokenRes = await fetch(`${accounts}/oauth/v2/token`, {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: pending.clientId,
          client_secret: pending.clientSecret,
          redirect_uri: REDIRECT_URI,
          code,
        }),
      });
      const token = await tokenRes.json();
      if (!token.refresh_token) {
        return send(400, page("Error", `<h1 class="err">Token exchange failed</h1><p>${token.error ?? "No refresh token returned"}. Check the client ID/secret and redirect URI, then <a href="/">try again</a>.</p>`));
      }
      const apiDomain = token.api_domain || `https://www.zohoapis.${pending.dc}`;

      const orgRes = await fetch(`${apiDomain}/inventory/v1/organizations`, {
        headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
      });
      const orgJson = await orgRes.json();
      const orgs = orgJson.organizations ?? [];
      const org = orgs.find((o) => o.is_default_org) ?? orgs[0];

      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        OUT_FILE,
        JSON.stringify(
          {
            client_id: pending.clientId,
            client_secret: pending.clientSecret,
            refresh_token: token.refresh_token,
            accounts_server: accounts,
            api_domain: apiDomain,
            organization_id: org?.organization_id ?? null,
            organization_name: org?.name ?? null,
            saved_at: new Date().toISOString(),
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );

      const orgLine = org
        ? `Organisation: <b>${org.name}</b>`
        : `<span class="err">No Zoho Inventory organisation found — open inventory.zoho.${pending.dc} and finish setup, then run this again.</span>`;
      send(200, page("Connected", `<h1 class="ok">Zoho connected ✓</h1><p>${orgLine}</p><p>You can close this tab and go back to Claude Code.</p>`));

      console.log(`\nZoho connected. ${org ? `Organisation: ${org.name}` : "WARNING: no Inventory organisation found."}`);
      console.log(`Credentials saved to ${OUT_FILE}`);
      setTimeout(() => process.exit(0), 500);
      return;
    }

    send(404, page("Not found", "<h1>Not found</h1>"));
  } catch (err) {
    console.error(err);
    send(500, page("Error", `<h1 class="err">Something went wrong</h1><p>${String(err.message)}</p>`));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Zoho login page: ${url}  (waiting up to 30 minutes...)`);
  const opener = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
  if (!process.env.NO_OPEN) exec(opener);
});

setTimeout(() => {
  console.log("Timed out waiting for Zoho login. Run the script again when ready.");
  process.exit(1);
}, 30 * 60 * 1000);
