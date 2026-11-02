// Netlify Function：把 API Key 留在服务器，浏览器只跟这个接口说话
// 部署位置：netlify/functions/recommend.mjs
// 需要的环境变量（Netlify → Site configuration → Environment variables）：
//   DEEPSEEK_API_KEY  必填
//   UPSTREAM_URL      可选，默认 https://api.deepseek.com/chat/completions
//   MODEL             可选，默认 deepseek-chat

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

const SYSTEM_PROMPT =
  "你是校园自习助手。用户会给一份空教室列表（格式：教室|楼|楼层|座位|标签|连空节数）和自己的偏好。" +
  "你只能从列表里挑一间，输出两行：第一行只写教室编号；第二行用不超过 60 字说明为什么适合，不要用列表符号。";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return json({ error: "只支持 POST" }, 405);
  }

  // ---- 入参校验：不能让调用方把任意内容塞给模型 ----
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  const need = String(body?.need || "").slice(0, 200);
  const rooms = Array.isArray(body?.rooms)
    ? body.rooms.slice(0, 15).map((r) => String(r).slice(0, 100))
    : [];

  if (rooms.length === 0) {
    return json({ error: "没有可选的空教室" }, 400);
  }

  // ---- Key 只从环境变量读，代码里没有 ----
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return json({ error: "服务端未配置 DEEPSEEK_API_KEY" }, 500);
  }

  const upstream = process.env.UPSTREAM_URL || "https://api.deepseek.com/chat/completions";
  const model = process.env.MODEL || "deepseek-chat";

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 180,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `偏好：${need || "没有特别偏好，挑一间最合适的"}\n空教室：\n${rooms.join("\n")}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ error: `上游返回 ${res.status}`, detail: detail.slice(0, 200) }, 502);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return json({ error: "模型没有返回内容" }, 502);

    return json({ text });
  } catch (err) {
    return json({ error: "上游请求失败：" + (err?.message || "unknown") }, 502);
  }
};
