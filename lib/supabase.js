export function supabaseReady() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url.startsWith("https://") && key.length > 20;
}

function endpoint(pathAndQuery) {
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathAndQuery}`;
}

function headers(prefer) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

export async function supabaseGet(pathAndQuery) {
  const response = await fetch(endpoint(pathAndQuery), {
    headers: headers("return=representation"),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase read failed: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

export async function supabaseInsert(table, row) {
  const response = await fetch(endpoint(table), {
    method: "POST",
    headers: headers("return=minimal"),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase write failed: ${detail.slice(0, 300)}`);
    if (response.status === 409 || detail.includes("duplicate")) error.code = "duplicate";
    throw error;
  }
}
