import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bookingUrl,
  contactHtml,
  escapeHtml,
  handleInbound,
  handleInquiry,
  mailReady,
  securityHeaders,
  telegramReady,
  sendJson,
  storageReady,
} from "./lib/office.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT) || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".json": "application/json; charset=utf-8",
};

function renderPage(filePath) {
  const file = fs.readFileSync(filePath, "utf8");
  return file
    .replaceAll("{{CONTACT}}", contactHtml())
    .replaceAll("{{BOOKING_URL}}", escapeHtml(bookingUrl()));
}

function publicFile(urlPath) {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relative = path.normalize(decoded.replace(/^[/\\]+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const full = path.join(publicDir, relative);
  const rootWithSep = publicDir.endsWith(path.sep) ? publicDir : publicDir + path.sep;
  if (full !== publicDir && !full.startsWith(rootWithSep)) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST" && url.pathname === "/api/inquiries") {
      await handleInquiry(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/inbound") {
      await handleInbound(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, { bookingUrl: bookingUrl(), contactHtml: contactHtml() });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { message: "This request is not available." });
      return;
    }

    const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = publicFile(requestPath);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      sendJson(res, 404, { message: "This page is not available." });
      return;
    }
    if (path.extname(file) === ".html") {
      const html = renderPage(file);
      res.writeHead(200, securityHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }));
      res.end(req.method === "HEAD" ? undefined : html);
      return;
    }
    const type = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
    const isMedia = type.startsWith("video/") || type.startsWith("image/");
    res.writeHead(
      200,
      securityHeaders({
        "Content-Type": type,
        "Cache-Control": isMedia ? "public, max-age=86400" : "no-store",
        "Accept-Ranges": "bytes",
      }),
    );
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    if (!res.headersSent) sendJson(res, status, { message: "The submission could not be completed." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT in .env to another port.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Meridian Advisory is at http://localhost:${port}`);
  if (storageReady()) console.log("Records will be saved in Supabase.");
  else console.log("Supabase is not configured. Submissions are saved in the data folder.");
  if (telegramReady()) console.log("Telegram is ready. Each inquiry will be sent to the configured chat.");
  else console.log("Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.");
  if (mailReady()) console.log(`Mail is ready. Submissions will be sent to ${process.env.ADVISOR_EMAIL}.`);
  else console.log("Mail is not configured. Set ADVISOR_EMAIL, RESEND_API_KEY, and RESEND_FROM in .env.");
});