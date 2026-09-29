import { bookingUrl, contactHtml, sendJson } from "../lib/office.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { message: "This request is not available." });
    return;
  }
  sendJson(res, 200, { bookingUrl: bookingUrl(), contactHtml: contactHtml() });
}
