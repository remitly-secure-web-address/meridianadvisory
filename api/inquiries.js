import { handleInquiry } from "../lib/office.js";

export default async function handler(req, res) {
  try {
    await handleInquiry(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = error.status || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ message: "The submission could not be completed." }));
    }
  }
}
