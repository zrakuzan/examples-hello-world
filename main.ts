const kv = await Deno.openKv();

const VALID_TOKEN = "2701_49d863:3c0762";

function checkToken(token: string | null): boolean {
  if (!token) return false;
  if (token.includes("badleroy")) return false;
  return token === VALID_TOKEN;
}

const jsonHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. Проверка дампа базы данных (Шаг 1)
  if (url.pathname === "/" || url.pathname === "/dump") {
    const list = [];
    for await (const entry of kv.list({ prefix: [] })) {
      list.push(entry);
    }
    return new Response(JSON.stringify(list), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  // Извлечение токена
  const token =
    url.searchParams.get("token") ||
    req.headers.get("X-Auth-Token") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/, "") ||
    null;

  // 2. Проверка токена: при ошибке статус 403 и обычный текст (Шаг 3)
  if (!checkToken(token)) {
    return new Response("Missing or invalid token", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  }

  // 3. Обработка маршрутов KV (Шаг 2)
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "kv") {
    const action = parts[1];
    const key = parts.slice(2);

    if (action === "list") {
      const list = [];
      const prefix = key.length > 0 ? key : [];
      for await (const entry of kv.list({ prefix })) {
        list.push(entry);
      }
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === "get") {
      const entry = await kv.get(key);
      return new Response(JSON.stringify(entry), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === "set" && req.method === "POST") {
      const body = await req.json();
      await kv.set(key, body);
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === "delete") {
      await kv.delete(key);
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }
  }

  return new Response("Not Found", { status: 404, headers: jsonHeaders });
});
