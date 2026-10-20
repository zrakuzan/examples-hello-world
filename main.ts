const kv = await Deno.openKv();

const MY_TOKEN = "2701_49d863:3c0762";

function checkToken(token: string | null): boolean {
  if (!token) return false;
  return token === MY_TOKEN;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Шаг 1: /dump
  if (url.pathname === "/" || url.pathname === "/dump") {
    const list = [];
    for await (const res of kv.list({ prefix: [] })) {
      list.push(res);
    }
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Извлечение токена (query параметр, X-Auth-Token или заголовок Authorization)
  const token =
    url.searchParams.get("token") ||
    req.headers.get("X-Auth-Token") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    null;

  // Шаг 3: при неверном токене СТРОГО статус 403 и обычный текст (не JSON)
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Шаг 2: Обработка путей /kv/...
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "kv") {
    const action = parts[1];
    const key = parts.slice(2);

    if (action === "list") {
      const list = [];
      const prefix = key.length > 0 ? key : [];
      for await (const res of kv.list({ prefix })) {
        list.push(res);
      }
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "get") {
      const entry = await kv.get(key);
      return new Response(JSON.stringify(entry), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "set" && req.method === "POST") {
      const val = await req.json();
      await kv.set(key, val);
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (action === "delete") {
      await kv.delete(key);
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  }

  return new Response("Not Found", { status: 404 });
});
