import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categories, labelOf, marketing, natures, plans } from "../catalog.js";
import { knownCountry, knownNiche, knownPlace, knownProduct } from "./lists.js";
import { supabaseGet, supabaseInsert, supabaseReady } from "./supabase.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(root, "..");
loadEnv(path.join(projectRoot, ".env"));
const dataDir = path.join(projectRoot, "data");
const dataFile = path.join(dataDir, "inquiries.jsonl");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hits = new Map();

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const entry = raw.trim();
    if (!entry || entry.startsWith("#")) continue;
    const index = entry.indexOf("=");
    if (index === -1) continue;
    const key = entry.slice(0, index).trim();
    let value = entry.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}

export function text(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function line(value) {
  return text(value).replace(/[\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[<>]/.test(value);
}

function normalizeUrl(value) {
  const cleaned = line(value);
  if (!cleaned) return "";
  return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  const today = new Date().toISOString().slice(0, 10);
  return value <= today;
}

function formatDay(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatStamp(date) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}

function stated(value) {
  const cleaned = text(value);
  return cleaned || "Not stated";
}

function row(label, value) {
  return `${label.padEnd(26, " ")}${stated(value)}`;
}

function saleLine(status, date, datedLabel, noneLabel) {
  if (status === "date" && date) return datedLabel.replace("{date}", formatDay(date));
  if (status === "not_yet") return "The store has not made a first sale";
  if (status === "none") return noneLabel;
  return "Not stated";
}

function marketingLine(values) {
  if (!values.length) return "Not stated";
  return values.map((value) => labelOf(marketing, value)).join("; ");
}

export function advisorText(record) {
  return [
    "MERIDIAN ADVISORY",
    "Record of a consultation request",
    "",
    row("Reference", record.reference),
    row("Received", record.received),
    "",
    row("Nature", labelOf(natures, record.nature)),
    row("Category", labelOf(categories, record.category)),
    "",
    row("Name", record.fullName),
    row("Email", record.email),
    row("Country", record.country),
    row("City or county", record.city),
    "",
    row("Store address", record.storeUrl),
    row("Niche", record.niche),
    row("Main product", record.product),
    row("Year created", record.yearCreated),
    row("Shopify plan", record.plan ? labelOf(plans, record.plan) : ""),
    row("First sale", saleLine(record.firstSale, record.firstSaleDate, "{date}", "")),
    row(
      "Most recent sale",
      saleLine(record.lastSale, record.lastSaleDate, "{date}", "There has been no sale"),
    ),
    row("Marketing at present", marketingLine(record.marketing)),
    row("Expert already engaged", record.expert),
    "",
    "Summary",
    record.summary,
    "",
    "Further detail",
    stated(record.detail),
    "",
    "Reply to this message to reach the person who submitted it.",
    "",
  ].join("\n");
}

export function submitterText(record) {
  return [
    "Meridian Advisory",
    "",
    "Your consultation request has been received.",
    "",
    `Reference: ${record.reference}`,
    `Received: ${record.received}`,
    `Nature: ${labelOf(natures, record.nature)}`,
    `Category: ${labelOf(categories, record.category)}`,
    "",
    "Please quote this reference in any further correspondence. A written reply will be sent to this email address.",
    "",
    "The reply is an assessment. It is not an undertaking as to sales, traffic, or any other result.",
    "",
    "Do not send passwords, staff invitations, or payment details.",
    "",
    "Meridian Advisory",
    "Advisory for Shopify stores",
    "",
  ].join("\n");
}

export function problemsFor(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const fullName = line(body.fullName);
  const email = line(body.email);
  const storeUrl = normalizeUrl(body.storeUrl);
  const summary = text(body.summary);
  const year = line(body.yearCreated);
  const nature = line(body.nature);
  const category = line(body.category);
  const plan = line(body.plan);
  const firstSale = line(body.firstSale);
  const lastSale = line(body.lastSale);
  const firstSaleDate = line(body.firstSaleDate);
  const lastSaleDate = line(body.lastSaleDate);
  const country = line(body.country);
  const city = line(body.city);
  const niche = line(body.niche);
  const product = line(body.product);

  if (fullName.length < 2 || fullName.length > 120 || !/\p{L}/u.test(fullName)) {
    add("fullName", "Enter your full name.");
  }
  if (!validEmail(email) || email.length > 200) add("email", "Enter a valid email address.");
  if (!validUrl(storeUrl) || storeUrl.length > 300) {
    add("storeUrl", "Enter the public address of the store.");
  }
  if (!natures.some(([value]) => value === nature)) {
    add("nature", "Select the nature of this submission.");
  }
  if (!categories.some(([value]) => value === category)) {
    add("category", "Select a category.");
  }
  if (summary.length < 20) add("summary", "Please give a fuller description.");
  if (summary.length > 4000) add("summary", "Shorten the description so it can be accepted.");
  if (body.consent !== true) add("consent", "Confirm the statement before submitting.");

  if (!knownCountry(country) || country.length > 160) {
    add("country", "Select a country from the list, or leave it unstated.");
  }
  if (city && !country) add("city", "Select a country before the city or county.");
  if (!knownPlace(country, city) || city.length > 160) {
    add("city", "Select a city or county for that country, or leave it unstated.");
  }
  if (!knownNiche(niche) || niche.length > 160) {
    add("niche", "Select a niche from the list, or leave it unstated.");
  }
  if (product && !niche) add("product", "Select a niche before the main product.");
  if (!knownProduct(niche, product) || product.length > 160) {
    add("product", "Select a main product for that niche, or leave it unstated.");
  }
  if (line(body.expert).length > 200) add("expert", "Shorten this answer so it can be accepted.");
  if (text(body.detail).length > 6000) add("detail", "Shorten the further detail so it can be accepted.");

  if (year) {
    const current = new Date().getFullYear();
    const parsed = Number(year);
    if (!/^\d{4}$/.test(year) || parsed < 2006 || parsed > current) {
      add("yearCreated", `Enter a year from 2006 to ${current}, or leave this blank.`);
    }
  }
  if (plan && !plans.some(([value]) => value === plan)) {
    add("plan", "Select a listed plan, or leave this blank.");
  }
  if (!["", "not_yet", "date"].includes(firstSale)) {
    add("firstSale", "Choose one of the answers for the first sale, or leave it unstated.");
  }
  if (!["", "none", "date"].includes(lastSale)) {
    add("lastSale", "Choose one of the answers for the most recent sale, or leave it unstated.");
  }
  if (firstSale === "date" && !validDate(firstSaleDate)) {
    add("firstSaleDate", "Enter a real date that is not in the future, or choose another answer.");
  }
  if (lastSale === "date" && !validDate(lastSaleDate)) {
    add("lastSaleDate", "Enter a real date that is not in the future, or choose another answer.");
  }
  if (body.marketing !== undefined && !Array.isArray(body.marketing)) {
    add("category", "The marketing answers could not be read. Please try again.");
  } else if (Array.isArray(body.marketing)) {
    const allowed = new Set(marketing.map(([value]) => value));
    if (body.marketing.some((value) => !allowed.has(value))) {
      add("category", "Select only the marketing choices listed on the form.");
    }
  }

  return errors;
}

function recordFrom(body, reference, receivedAt) {
  const selectedMarketing = Array.isArray(body.marketing) ? body.marketing.map(line) : [];
  return {
    reference,
    receivedAt: receivedAt.toISOString(),
    received: formatStamp(receivedAt),
    fullName: line(body.fullName),
    email: line(body.email),
    city: line(body.city),
    country: line(body.country),
    storeUrl: normalizeUrl(body.storeUrl),
    niche: line(body.niche),
    product: line(body.product),
    yearCreated: line(body.yearCreated),
    plan: line(body.plan),
    firstSale: line(body.firstSale),
    firstSaleDate: line(body.firstSale) === "date" ? line(body.firstSaleDate) : "",
    lastSale: line(body.lastSale),
    lastSaleDate: line(body.lastSale) === "date" ? line(body.lastSaleDate) : "",
    marketing: selectedMarketing,
    expert: line(body.expert),
    nature: line(body.nature),
    category: line(body.category),
    summary: text(body.summary),
    detail: text(body.detail),
  };
}

function dbRow(record) {
  return {
    reference: record.reference,
    received_at: record.receivedAt,
    received_label: record.received,
    full_name: record.fullName,
    email: record.email,
    city: record.city,
    country: record.country,
    store_url: record.storeUrl,
    niche: record.niche,
    product: record.product,
    year_created: record.yearCreated,
    shopify_plan: record.plan,
    first_sale: record.firstSale,
    first_sale_date: record.firstSaleDate,
    last_sale: record.lastSale,
    last_sale_date: record.lastSaleDate,
    marketing: record.marketing,
    expert: record.expert,
    nature: record.nature,
    category: record.category,
    summary: record.summary,
    detail: record.detail,
  };
}

function newSuffix() {
  const bytes = crypto.randomBytes(4);
  let suffix = "";
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return suffix;
}

async function referenceTaken(reference) {
  if (supabaseReady()) {
    const rows = await supabaseGet(
      `inquiries?reference=eq.${encodeURIComponent(reference)}&select=reference`,
    );
    return rows.length > 0;
  }
  return fs.existsSync(path.join(dataDir, `${reference}.txt`));
}

async function createReference(now) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference = `MER.${year}${month}${day}.${newSuffix()}`;
    if (!(await referenceTaken(reference))) return reference;
  }
  throw new Error("A reference number could not be issued.");
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function limited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const recent = (hits.get(ip) || []).filter((time) => now - time < windowMs);
  if (recent.length >= 30) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

async function emailLimited(email) {
  if (!supabaseReady()) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rows = await supabaseGet(
    `inquiries?email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(since)}&select=id`,
  );
  return rows.length >= 8;
}

export function storageReady() {
  return supabaseReady();
}

export function mailReady() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM &&
      validEmail(process.env.ADVISOR_EMAIL || ""),
  );
}

export function telegramReady() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chat = process.env.TELEGRAM_CHAT_ID || "";
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token) && /^-?\d{5,}$/.test(chat);
}

function htmlValue(value) {
  return escapeHtml(stated(value));
}

function entry(label, valueHtml) {
  return `<b>${escapeHtml(label)}</b>\n${valueHtml}`;
}

function section(title, entries) {
  return [`<b>${escapeHtml(title)}</b>`, ...entries].join("\n\n");
}

function mailLink(email) {
  const safe = escapeHtml(email);
  return `<a href="mailto:${safe}">${safe}</a>`;
}

function webLink(url) {
  const cleaned = text(url);
  if (!cleaned) return "Not stated";
  const safe = escapeHtml(cleaned);
  return `<a href="${safe}">${safe}</a>`;
}

function splitEscaped(value, size) {
  const parts = [];
  let rest = value;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size / 2) cut = rest.lastIndexOf(" ", size);
    if (cut < size / 2) cut = size;
    const amp = rest.lastIndexOf("&", cut);
    const semi = rest.lastIndexOf(";", cut);
    if (amp > semi && cut - amp < 12) cut = amp;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function proseBlocks(label, value) {
  const chunks = splitEscaped(escapeHtml(stated(value)), 2800);
  return chunks.map((chunk, index) => {
    const title = index === 0 ? label : `${label}, continued`;
    return `<b>${escapeHtml(title)}</b>\n<blockquote>${chunk}</blockquote>`;
  });
}

function marketingHtml(values) {
  if (!values?.length) return "Not stated";
  return values.map((value) => escapeHtml(labelOf(marketing, value) || value)).join("\n");
}

function noticeBanner(record) {
  return [
    "<b>MERIDIAN ADVISORY</b>",
    "Consultation request",
    "",
    entry("Reference", escapeHtml(record.reference)),
    "",
    entry("Received", escapeHtml(record.received)),
  ].join("\n");
}

function correspondence(record) {
  const email = escapeHtml(record.email);
  const reference = escapeHtml(record.reference);
  return [
    "<b>Correspondence</b>",
    `Reply in writing to <a href="mailto:${email}">${email}</a>.`,
    `Quote <b>${reference}</b> in the subject line of the reply.`,
  ].join("\n");
}

function packNotice(banner, blocks) {
  const limit = 3900;
  const messages = [];
  let current = banner;
  for (const block of blocks) {
    const combined = `${current}\n\n${block}`;
    if (combined.length <= limit) {
      current = combined;
      continue;
    }
    if (current !== banner) {
      messages.push(current);
      current = banner;
    }
    const retry = `${current}\n\n${block}`;
    if (retry.length <= limit) {
      current = retry;
      continue;
    }
    messages.push(retry.slice(0, limit));
    current = banner;
  }
  if (current !== banner) messages.push(current);
  if (!messages.length) messages.push(banner);
  return messages;
}

function numberParts(messages) {
  if (messages.length < 2) return messages;
  return messages.map((message, index) =>
    message.replace(
      "<b>MERIDIAN ADVISORY</b>\nConsultation request",
      `<b>MERIDIAN ADVISORY</b>\nConsultation request\nPart ${index + 1} of ${messages.length}`,
    ),
  );
}

export function telegramMessages(record) {
  const blocks = [
    section("Your details", [
      entry("Full name", htmlValue(record.fullName)),
      entry("Email address", mailLink(record.email)),
      entry("Country", htmlValue(record.country)),
      entry("City or county", htmlValue(record.city)),
    ]),
    section("The store", [
      entry("Store address", webLink(record.storeUrl)),
      entry("Niche", htmlValue(record.niche)),
      entry("Main product", htmlValue(record.product)),
      entry("Year the store was created", htmlValue(record.yearCreated)),
      entry("Shopify plan", htmlValue(record.plan ? labelOf(plans, record.plan) : "")),
      entry("First sale", escapeHtml(saleLine(record.firstSale, record.firstSaleDate, "{date}", ""))),
      entry(
        "Most recent sale",
        escapeHtml(saleLine(record.lastSale, record.lastSaleDate, "{date}", "There has been no sale")),
      ),
      entry("Marketing presently in use", marketingHtml(record.marketing)),
      entry("Expert, agency, or freelancer already engaged", htmlValue(record.expert)),
    ]),
    section("The inquiry", [
      entry("Nature of the inquiry", htmlValue(labelOf(natures, record.nature))),
      entry("Category", htmlValue(labelOf(categories, record.category))),
    ]),
    ...proseBlocks("Description", record.summary),
    ...proseBlocks("Further detail", record.detail),
    correspondence(record),
  ];
  return numberParts(packNotice(noticeBanner(record), blocks));
}

export async function sendTelegram(record) {
  if (!telegramReady()) return false;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const messages = telegramMessages(record);
  for (const message of messages) {
    let response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      console.error("The Telegram notice could not be sent.");
      return false;
    }
    if (!response.ok) {
      console.error(`Telegram was not accepted (${response.status}).`);
      return false;
    }
  }
  return true;
}

export async function sendMail({ to, replyTo, subject, textBody }) {
  if (!mailReady() || !validEmail(to)) return { ok: false, id: "" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [to],
      reply_to: replyTo,
      subject,
      text: textBody,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Mail to ${to} was not accepted: ${detail.slice(0, 400)}`);
    return { ok: false, id: "" };
  }
  const payload = await response.json().catch(() => ({}));
  return { ok: true, id: payload.id || "" };
}

async function rememberMessage(entry) {
  if (!supabaseReady()) return;
  try {
    await supabaseInsert("messages", entry);
  } catch (error) {
    console.error(error.message);
  }
}

async function saveLocal(record, dossier) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(dataFile, `${JSON.stringify(record)}\n`);
  fs.writeFileSync(path.join(dataDir, `${record.reference}.txt`), dossier, "utf8");
}

async function saveRecord(record, dossier) {
  if (supabaseReady()) {
    await supabaseInsert("inquiries", dbRow(record));
    return;
  }
  await saveLocal(record, dossier);
}

export function bookingUrl() {
  const fallback = "https://www.bookheld.app/book/gasl";
  const value = process.env.BOOKING_URL || fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

export function contactHtml() {
  const email = process.env.ADVISOR_EMAIL || "";
  if (!validEmail(email)) {
    return "Please quote your reference number in further correspondence.";
  }
  const safe = escapeHtml(email);
  return `Please quote your reference number in further correspondence. You may also write to <a href="mailto:${safe}">${safe}</a>.`;
}

export function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'",
    ...extra,
  };
}

export function sendJson(res, status, payload) {
  res.writeHead(
    status,
    securityHeaders({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }),
  );
  res.end(JSON.stringify(payload));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(Object.assign(new Error("too_large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("invalid_json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

export function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 200_000) {
        reject(Object.assign(new Error("too_large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function handleInquiry(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "This request is not available." });
    return;
  }
  if (limited(clientIp(req))) {
    sendJson(res, 429, {
      message: "Too many submissions have been received from this connection.",
    });
    return;
  }

  const body = await readBody(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendJson(res, 400, { message: "The submission could not be read." });
    return;
  }

  if (line(body.hp)) {
    const now = new Date();
    sendJson(res, 201, {
      reference: `MER.${now.getUTCFullYear()}0000.0000`,
      emailedAdvisor: false,
      emailedSubmitter: false,
    });
    return;
  }

  const errors = problemsFor(body);
  if (errors.length) {
    sendJson(res, 422, { errors });
    return;
  }

  if (await emailLimited(line(body.email))) {
    sendJson(res, 429, {
      message: "Several requests have been received for this email address. Please wait, then try again.",
    });
    return;
  }

  const receivedAt = new Date();
  const reference = await createReference(receivedAt);
  const record = recordFrom(body, reference, receivedAt);
  const dossier = advisorText(record);
  await saveRecord(record, dossier);

  let emailedAdvisor = false;
  let emailedSubmitter = false;
  let notifiedOffice = false;
  if (telegramReady()) {
    try {
      notifiedOffice = await sendTelegram(record);
    } catch {
      console.error("The Telegram notice could not be sent.");
    }
  }
  if (mailReady()) {
    const nature = labelOf(natures, record.nature);
    try {
      const advisorMail = await sendMail({
        to: process.env.ADVISOR_EMAIL,
        replyTo: record.email,
        subject: `${record.reference} | ${nature} | ${record.fullName}`.slice(0, 180),
        textBody: dossier,
      });
      emailedAdvisor = advisorMail.ok;
      notifiedOffice = notifiedOffice || advisorMail.ok;
      if (advisorMail.ok) {
        await rememberMessage({
          reference: record.reference,
          direction: "advisor",
          resend_id: advisorMail.id,
          from_email: process.env.RESEND_FROM,
          to_email: process.env.ADVISOR_EMAIL,
          subject: `${record.reference} | ${nature} | ${record.fullName}`.slice(0, 180),
          body: dossier,
        });
      }
    } catch (error) {
      console.error("The office email could not be sent.", error.message);
    }
    try {
      const subject = `Meridian Advisory | ${record.reference}`;
      const confirmation = submitterText(record);
      const submitterMail = await sendMail({
        to: record.email,
        replyTo: process.env.ADVISOR_EMAIL,
        subject,
        textBody: confirmation,
      });
      emailedSubmitter = submitterMail.ok;
      if (submitterMail.ok) {
        await rememberMessage({
          reference: record.reference,
          direction: "submitter",
          resend_id: submitterMail.id,
          from_email: process.env.RESEND_FROM,
          to_email: record.email,
          subject,
          body: confirmation,
        });
      }
    } catch (error) {
      console.error("The confirmation email could not be sent.", error.message);
    }
  }

  console.log(`${reference} recorded for ${record.email}`);
  sendJson(res, 201, { reference, emailedAdvisor, emailedSubmitter, notifiedOffice });
}

export function verifyWebhook(rawBody, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  if (!secret.startsWith("whsec_")) return false;
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];
  if (!id || !timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : "";
    if (!value || value.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  });
}

async function receivedBody(emailId) {
  if (!emailId || !process.env.RESEND_API_KEY) return "";
  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return "";
  const payload = await response.json();
  return text(payload.text || payload.html || "").slice(0, 20000);
}

export async function handleInbound(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "This request is not available." });
    return;
  }
  const raw = await readRaw(req);
  if (!verifyWebhook(raw, req.headers)) {
    sendJson(res, 401, { message: "The notice could not be verified." });
    return;
  }
  let event = {};
  try {
    event = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { message: "The notice could not be read." });
    return;
  }
  if (event.type !== "email.received") {
    sendJson(res, 200, { received: true });
    return;
  }

  const data = event.data || {};
  const from = line(data.from);
  const to = Array.isArray(data.to) ? data.to.map(line).join(", ") : line(data.to);
  const subject = line(data.subject).slice(0, 300);
  const body = await receivedBody(data.email_id);
  const referenceMatch = `${subject}\n${body}`.match(/MER\.\d{8}\.[A-Z0-9]+/);
  await rememberMessage({
    reference: referenceMatch ? referenceMatch[0] : "",
    direction: "inbound",
    resend_id: line(data.email_id),
    from_email: from,
    to_email: to,
    subject,
    body,
  });

  const advisor = process.env.ADVISOR_EMAIL || "";
  if (mailReady() && validEmail(from) && from.toLowerCase() !== advisor.toLowerCase()) {
    try {
      await sendMail({
        to: advisor,
        replyTo: from,
        subject: subject ? `Received | ${subject}`.slice(0, 180) : "Received correspondence",
        textBody: [`From: ${from}`, `To: ${to}`, "", body || "The message had no text."].join("\n"),
      });
    } catch (error) {
      console.error("The received message could not be forwarded.", error.message);
    }
  }

  sendJson(res, 200, { received: true });
}
