import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:3000";
  const body = await req.text();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const auth = req.headers.get("authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }

  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body,
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}
