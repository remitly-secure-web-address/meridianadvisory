import { handleInbound } from "../lib/office.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    await handleInbound(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = error.status || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ message: "The notice could not be completed." }));
    }
  }
}
