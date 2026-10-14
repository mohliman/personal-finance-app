import { createServer } from "node:http";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";

const derive = promisify(scrypt);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("hex");
export const uid = () => randomUUID();
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export function textValue(value, label, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(422, `${label} is required (maximum ${max} characters).`);
  return value.trim();
}
export function moneyCents(value, positive = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 1e9 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001 ||
    (positive && value <= 0)
  )
    fail(422, "Use a valid amount with up to two decimal places.");
  return Math.round(value * 100);
}
export function transaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function createApplication(adapter, options = {}) {
  const root = options.root ?? process.cwd();
  const databasePath =
    options.databasePath ??
    process.env.DATABASE_PATH ??
    resolve(root, "data/app.sqlite");
  if (databasePath !== ":memory:" && !(options.cloudUrl ?? process.env.TURSO_DATABASE_URL))
    mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const cloudUrl = options.cloudUrl ?? process.env.TURSO_DATABASE_URL;
  const cloudToken = options.cloudToken ?? process.env.TURSO_AUTH_TOKEN;
  if (process.env.RENDER === 'true' && (!cloudUrl || !cloudToken)) throw new Error('Render requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for persistent storage.');
  if (cloudUrl && !cloudToken) throw new Error('TURSO_AUTH_TOKEN is required for hosted storage.');
  if (cloudUrl && !cloudUrl.startsWith('libsql://') && !cloudUrl.startsWith('https://')) throw new Error('Hosted database URL must use TLS.');
  const useLibsql = Boolean(cloudUrl || options.driver === 'libsql' || process.env.DATABASE_DRIVER === 'libsql');
  const db = useLibsql ? new (require('libsql'))(cloudUrl ?? databasePath, cloudUrl ? {authToken: cloudToken} : {}) : new DatabaseSync(databasePath);
  // Turso manages its journal and lock timeout; those PRAGMAs are local-only.
  if (!cloudUrl) db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    INSERT OR IGNORE INTO schema_migrations VALUES(1, datetime('now'));`);
  adapter.initialize(db);
  const configuredOrigin = options.origin ?? process.env.APP_ORIGIN ?? process.env.RENDER_EXTERNAL_URL;
  const additionalOrigins = options.additionalOrigins ?? (process.env.ADDITIONAL_APP_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  for (const origin of additionalOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !["https:", "http:"].includes(parsed.protocol) || (process.env.NODE_ENV === "production" && parsed.protocol !== "https:"))
      throw new Error("Additional app origins must be exact origins and use HTTPS in production.");
  }
  const secure = (configuredOrigin ?? "").startsWith(
    "https://",
  );
  if (process.env.NODE_ENV === "production" && !secure && !options.allowHttp)
    throw new Error("Production requires APP_ORIGIN with https://.");
  const cookieName = `${adapter.name}_session`;
  const csrfName = `${adapter.name}_csrf`;
  const cookie = (name, value, age) =>
    `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  const limits = new Map();
  const dummySalt = randomBytes(16).toString("hex");
  function limit(key, maximum = 30) {
    const now = Date.now();
    if (limits.size > 10000)
      for (const [k, v] of limits) if (now > v.end) limits.delete(k);
    const current = limits.get(key);
    const next =
      current && now < current.end ? current : { count: 0, end: now + 900000 };
    if (++next.count > maximum)
      fail(429, "Too many attempts. Please try again in 15 minutes.");
    limits.set(key, next);
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      const cookies = Object.fromEntries(
        (req.headers.cookie ?? "")
          .split(";")
          .filter((v) => v.includes("="))
          .map((v) => {
            const at = v.indexOf("=");
            return [v.slice(0, at).trim(), v.slice(at + 1)];
          }),
      );
      let csrf = cookies[csrfName];
      if (!csrf || !/^[a-f0-9]{64}$/.test(csrf)) {
        csrf = secret();
        res.setHeader("Set-Cookie", cookie(csrfName, csrf, 604800));
      }
      const session = cookies[cookieName]
        ? db
            .prepare(
              "SELECT u.id,u.email,u.name,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
            )
            .get(hash(cookies[cookieName]), Date.now())
        : null;
      const user = session
        ? { id: session.id, email: session.email, name: session.name }
        : null;
      const path = url.pathname;
      if (path === "/api/health" && req.method === "GET")
        return json(200, { ok: true, app: adapter.name });
      if (path === "/api/session" && req.method === "GET")
        return json(200, { user, csrf });
      if (!path.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD")
          return json(405, { error: "Method not allowed." });
        const publicRoot = resolve(root, "dist");
        const requested = resolve(publicRoot, "." + decodeURIComponent(path));
        if (requested !== publicRoot && !requested.startsWith(publicRoot + sep))
          fail(404, "Not found.");
        const asset =
          existsSync(requested) && statSync(requested).isFile()
            ? requested
            : extname(path)
              ? null
              : resolve(publicRoot, "index.html");
        if (!asset || !existsSync(asset))
          fail(404, "Build the frontend with npm run build first.");
        const mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".webp": "image/webp",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
          ".json": "application/json",
        };
        res.writeHead(200, {
          "Content-Type": mime[extname(asset)] ?? "application/octet-stream",
          "Cache-Control":
            extname(asset) === ".html" ? "no-cache" : "public, max-age=3600",
        });
        return res.end(req.method === "HEAD" ? undefined : readFileSync(asset));
      }
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method))
        fail(405, "Method not allowed.");
      let body = {};
      if (req.method !== "GET") {
        const origin = req.headers.origin;
        const configured = configuredOrigin;
        const allowed = configured
          ? [configured, ...additionalOrigins]
          : [`http://${req.headers.host}`, ...additionalOrigins];
        if (origin && !allowed.includes(origin))
          fail(403, "This origin is not allowed.");
        if (req.headers["sec-fetch-site"] === "cross-site")
          fail(403, "Cross-site request denied.");
        if (
          !cookies[csrfName] ||
          req.headers["x-csrf-token"] !== cookies[csrfName]
        )
          fail(403, "Refresh the page before trying again.");
        if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
          fail(415, "Send JSON with Content-Type: application/json.");
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2 * 1024 * 1024) fail(413, "Request is too large.");
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        } catch {
          fail(400, "Invalid JSON.");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          fail(400, "Send a JSON object.");
      }
      if (
        ["/api/register", "/api/login"].includes(path) &&
        req.method === "POST"
      ) {
        limit(`auth:${req.socket.remoteAddress}`);
        const email = textValue(body.email, "Email", 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          fail(422, "Enter a valid email address.");
        if (
          typeof body.password !== "string" ||
          body.password.length < 12 ||
          body.password.length > 128
        )
          fail(422, "Use a password between 12 and 128 characters.");
        limit(`email:${email}`, 15);
        let account;
        if (path === "/api/register") {
          const name = textValue(body.name, "Name", 80);
          if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
            fail(409, "An account already uses this email. Sign in instead.");
          const salt = randomBytes(16).toString("hex");
          const key = await derive(body.password, salt, 64, {
            N: 32768,
            maxmem: 64 * 1024 * 1024,
          });
          account = { id: uid(), email, name };
          transaction(db, () => {
            db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
              account.id,
              email,
              name,
              `${salt}:${key.toString("hex")}`,
              new Date().toISOString(),
            );
            adapter.register(db, account, body);
          });
        } else {
          const found = db
            .prepare("SELECT * FROM users WHERE email=?")
            .get(email);
          const [salt, stored] = found
            ? found.password_hash.split(":")
            : [dummySalt, "0".repeat(128)];
          const key = await derive(body.password, salt, 64, {
            N: 32768,
            maxmem: 64 * 1024 * 1024,
          });
          if (!timingSafeEqual(key, Buffer.from(stored, "hex")) || !found)
            fail(401, "Email or password is incorrect.");
          account = { id: found.id, email: found.email, name: found.name };
        }
        // Rotate the session and prune expired records on authentication.
        if (cookies[cookieName])
          db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
            hash(cookies[cookieName]),
          );
        db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
        const token = secret();
        csrf = secret();
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
          hash(token),
          account.id,
          Date.now() + 604800000,
        );
        res.setHeader("Set-Cookie", [
          cookie(cookieName, token, 604800),
          cookie(csrfName, csrf, 604800),
        ]);
        return json(200, { user: account, csrf });
      }
      if (!user) fail(401, "Please sign in to continue.");
      if (path === "/api/logout" && req.method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
          hash(cookies[cookieName]),
        );
        res.setHeader("Set-Cookie", cookie(cookieName, "", 0));
        return json(200, { ok: true });
      }
      if (req.method !== "GET") limit(`write:${user.id}`, 400);
      const result = adapter.handle({ db, user, req, url, body });
      if (result === undefined) fail(404, "Endpoint not found.");
      return json(200, result);
    } catch (error) {
      const status = error.status ?? 500;
      if (status === 500) console.error("Request failed:", error.message);
      if (!res.headersSent)
        json(status, {
          error:
            status === 500
              ? "The server could not complete this request."
              : error.message,
        });
      else res.end();
    }
  });
  return {
    server,
    db,
    close: () =>
      new Promise((resolveClose) => {
        server.close(() => {
          db.close();
          resolveClose();
        });
        server.closeIdleConnections();
      }),
  };
}
export function listen(application, defaultPort) {
  const port = Number(process.env.PORT ?? defaultPort);
  const host = process.env.HOST ?? "127.0.0.1";
  application.server.listen(port, host, () =>
    console.log(`App ready at http://${host}:${port}`),
  );
  const shutdown = () => application.close().then(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
