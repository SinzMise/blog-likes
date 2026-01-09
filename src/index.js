export default {
  async fetch(request, env, ctx) {
    const { DB } = env;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    // 日志
    const nowStr = new Date().toISOString();
    const requestIP =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const logObj = {
      time: nowStr,
      url: request.url,
      method: request.method,
      ip: requestIP,
      ua: userAgent
    };
    console.log("Request Log:", JSON.stringify(logObj));

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 只处理 /like 路由
    if (pathname !== "/like") {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    const urlKey = body && body.Url;
    const addLikes = parseInt(body && body.Add ? body.Add : 0, 10);

    if (!urlKey) {
      return new Response(JSON.stringify({ error: "Missing Url in body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    let result;
    try {
      result = await DB.prepare("SELECT likes FROM likes WHERE url = ?")
        .bind(urlKey)
        .first();
    } catch (e) {
      console.error("DB SELECT error:", e);
      return new Response(JSON.stringify({ error: "DB SELECT error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    let likes = result && result.likes ? parseInt(result.likes, 10) : 0;
    let hasRow = !!result;

    try {
      if (addLikes > 0) {
        if (hasRow) {
          likes += addLikes;
          await DB.prepare("UPDATE likes SET likes = ? WHERE url = ?")
            .bind(likes, urlKey)
            .run();
        } else {
          likes = addLikes;
          await DB.prepare("INSERT INTO likes (url, likes) VALUES (?, ?)")
            .bind(urlKey, likes)
            .run();
        }
      } else {
        if (!hasRow) {
          likes = 0;
          await DB.prepare("INSERT INTO likes (url, likes) VALUES (?, ?)")
            .bind(urlKey, likes)
            .run();
        }
      }
    } catch (e) {
      console.error("DB INSERT/UPDATE error:", e);
      return new Response(JSON.stringify({ error: "DB write error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ likes }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
}