/* ============================================================
   空教室查询 — 界面逻辑
   数据/规则都在 core.js 里，这里只负责"把结果画出来"和"响应点击"
   ============================================================ */

/* ---------- 1. 状态 ---------- */
const FAV_KEY = "axiom_emptyroom_favs_v1";
const CFG_KEY = "axiom_ai_cfg_v1";

const state = {
  dayOffset: 0,        // 0 = 今天，1 = 明天
  period: 0,           // 第几节（0–4）
  building: "all",     // all 或楼栋 id
  query: "",           // 搜索词
  onlyFav: false,      // 只看收藏
  favs: loadFavs(),
  detailId: null,      // 当前打开的教室详情
};

let config = loadConfig();

function loadFavs() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFavs() {
  localStorage.setItem(FAV_KEY, JSON.stringify(state.favs));
}

function loadConfig() {
  const fallback = {
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    key: "",
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

/** 把"今天+偏移"算成一个整数，用作模拟排课的种子 */
function dayStampFor(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function dayStamp() {
  return dayStampFor(state.dayOffset);
}

/* ---------- 2.5 地址栏状态 ----------
   把"哪天/哪节/哪栋"写进 URL，好处：
   1. 刷新页面不会跳回默认
   2. 可以直接把某个视图发给别人，比如 #day=1&period=3&building=lib */

function readHash() {
  try {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    const out = {};
    if (p.has("day")) out.dayOffset = Number(p.get("day")) === 1 ? 1 : 0;
    if (p.has("period")) {
      const v = Number(p.get("period"));
      if (Number.isInteger(v) && v >= 0 && v < Core.PERIODS.length) out.period = v;
    }
    if (p.has("building")) {
      const b = p.get("building");
      if (b === "all" || Core.BUILDINGS.some((x) => x.id === b)) out.building = b;
    }
    return out;
  } catch {
    return null;
  }
}

function syncHash() {
  try {
    const h = `#day=${state.dayOffset}&period=${state.period}&building=${state.building}`;
    history.replaceState(null, "", h);
  } catch {
    /* file:// 下某些浏览器会拦 history，忽略即可 */
  }
}

/* ---------- 2. 元素 ---------- */
const $ = (id) => document.getElementById(id);

const els = {
  clock: $("clockText"),
  daySeg: $("daySeg"),
  autoTip: $("autoTip"),
  periodRow: $("periodRow"),
  buildingRow: $("buildingRow"),
  search: $("search"),
  summary: $("summaryText"),
  favToggle: $("favToggle"),
  grid: $("roomGrid"),
  need: $("need"),
  aiBtn: $("aiBtn"),
  aiOut: $("aiOut"),
  settingsBtn: $("settingsBtn"),
  modal: $("settingsModal"),
  cfgEndpoint: $("cfgEndpoint"),
  cfgModel: $("cfgModel"),
  cfgKey: $("cfgKey"),
  settingsSave: $("settingsSave"),
  settingsCancel: $("settingsCancel"),
  // 教室详情
  detailModal: $("detailModal"),
  detailTitle: $("detailTitle"),
  detailMeta: $("detailMeta"),
  detailTags: $("detailTags"),
  detailToday: $("detailToday"),
  detailTomorrow: $("detailTomorrow"),
  detailClose: $("detailClose"),
  detailFav: $("detailFav"),
};

/* ---------- 3. 渲染：控制区 ---------- */

function renderPeriods() {
  els.periodRow.innerHTML = "";
  Core.PERIODS.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "period" + (i === state.period ? " is-on" : "");
    btn.innerHTML = ""; // 清空
    const b = document.createElement("b");
    b.textContent = p.label;
    const s = document.createElement("span");
    s.textContent = p.start + "–" + p.end;
    btn.append(b, s);
    btn.addEventListener("click", () => {
      state.period = i;
      renderPeriods();
      renderRooms();
    });
    els.periodRow.appendChild(btn);
  });
}

function renderBuildings() {
  els.buildingRow.innerHTML = "";
  const all = [{ id: "all", name: "全部" }].concat(Core.BUILDINGS);
  all.forEach((b) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (state.building === b.id ? " is-on" : "");
    btn.textContent = b.name;
    btn.addEventListener("click", () => {
      state.building = b.id;
      renderBuildings();
      renderRooms();
    });
    els.buildingRow.appendChild(btn);
  });
}

function renderDaySeg() {
  els.daySeg.querySelectorAll(".seg-btn").forEach((btn) => {
    const day = Number(btn.dataset.day);
    btn.classList.toggle("is-on", day === state.dayOffset);
  });
}

/* ---------- 4. 渲染：教室卡片 ---------- */

function renderRooms() {
  const list = Core.freeRooms({
    dayStamp: dayStamp(),
    period: state.period,
    building: state.building,
    query: state.query,
    favs: state.favs,
  });

  const shown = state.onlyFav ? list.filter((r) => r.fav) : list;

  const st = Core.stats(dayStamp(), state.period);
  els.summary.textContent =
    `全校 ${st.total} 间 · 这一节空 ${st.free} 间` +
    (shown.length !== st.free ? ` · 当前筛选出 ${shown.length} 间` : "");

  els.grid.innerHTML = "";

  if (shown.length === 0) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = state.onlyFav
      ? "还没有收藏的教室。点卡片右上角的 ☆ 收藏常去的教室，下次它会排在最前面。"
      : "这个条件下没有空教室。换个节次或楼栋试试。";
    els.grid.appendChild(div);
    return;
  }

  shown.forEach((room) => {
    const card = document.createElement("article");
    card.className = "room" + (room.fav ? " is-fav" : "");

    const id = document.createElement("div");
    id.className = "room-id";
    id.textContent = room.id;

    const meta = document.createElement("div");
    meta.className = "room-meta";
    meta.textContent = `${room.buildingName} · ${room.floor} 层`;

    const star = document.createElement("button");
    star.type = "button";
    star.className = "star";
    star.title = room.fav ? "取消收藏" : "收藏";
    star.textContent = room.fav ? "★" : "☆";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFav(room.id);
    });

    const tags = document.createElement("div");
    tags.className = "tags";
    const seat = document.createElement("span");
    seat.className = "tag seats";
    seat.textContent = room.seats + " 座";
    tags.appendChild(seat);
    room.tags.forEach((t) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = t;
      tags.appendChild(el);
    });

    const foot = document.createElement("div");
    foot.className = "room-foot";
    foot.textContent = room.free > 1 ? `接下来 ${room.free} 节都空` : "只有这一节空";

    // 整张卡片可点：打开这间教室的全天时间轴
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${room.id}，${room.seats} 座，查看全天安排`);
    card.addEventListener("click", () => openDetail(room.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(room.id);
      }
    });

    card.append(star, id, meta, tags, foot);
    els.grid.appendChild(card);
  });

  syncHash();
  updateTip();
}

function toggleFav(id) {
  if (state.favs.includes(id)) {
    state.favs = state.favs.filter((x) => x !== id);
  } else {
    state.favs.push(id);
  }
  saveFavs();
  renderRooms();

  // 详情页开着的话，同步按钮状态
  if (!els.detailModal.hidden) {
    els.detailFav.textContent = state.favs.includes(id) ? "★ 已收藏" : "☆ 收藏";
  }
}

/* ---------- 4.5 教室详情：全天时间轴 ---------- */

function openDetail(roomId) {
  const room = Core.ROOMS.find((r) => r.id === roomId);
  if (!room) return;

  els.detailTitle.textContent = room.id;
  els.detailMeta.textContent =
    `${Core.buildingOf(room.b).name} · ${room.floor} 层 · ${room.seats} 座`;

  els.detailTags.innerHTML = "";
  room.tags.forEach((t) => {
    const el = document.createElement("span");
    el.className = "tag";
    el.textContent = t;
    els.detailTags.appendChild(el);
  });

  renderTimeline(els.detailToday, roomId, 0);
  renderTimeline(els.detailTomorrow, roomId, 1);

  els.detailFav.textContent = state.favs.includes(roomId) ? "★ 已收藏" : "☆ 收藏";
  state.detailId = roomId;
  els.detailModal.hidden = false;
  els.detailClose.focus();
}

/** 把某间教室某一天的 5 个节次画成一排色块 */
function renderTimeline(container, roomId, offset) {
  const schedule = Core.daySchedule(roomId, dayStampFor(offset));
  container.innerHTML = "";

  Core.PERIODS.forEach((p, i) => {
    const cell = document.createElement("div");
    cell.className = "slot " + (schedule[i] ? "free" : "busy");

    const name = document.createElement("b");
    name.textContent = p.label.replace("第 ", "").replace(" 节", "");

    const time = document.createElement("span");
    time.textContent = p.start;

    const stateText = document.createElement("em");
    stateText.textContent = schedule[i] ? "空" : "有课";

    cell.append(name, time, stateText);
    cell.title = `${p.label} ${p.start}–${p.end}：${schedule[i] ? "空闲" : "有课"}`;
    container.appendChild(cell);
  });
}

function closeDetail() {
  els.detailModal.hidden = true;
}

/* ---------- 5. 时钟与默认时段 ---------- */

function updateClock() {
  const now = new Date();
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  const p = Core.periodAt(now);
  let phase;
  if (p >= 0) {
    phase = `正在上${Core.PERIODS[p].label}`;
  } else {
    const mins = now.getHours() * 60 + now.getMinutes();
    const last = Core.PERIODS[Core.PERIODS.length - 1].end.split(":").map(Number);
    phase = mins > last[0] * 60 + last[1] ? "今天已下课" : "课间";
  }

  els.clock.textContent = `${week} ${hh}:${mm} · ${phase}`;
}

/** 选中时段相对"现在"的状态提示，避免看着过期数据做决定 */
function updateTip() {
  let text = "";

  if (state.dayOffset === 1) {
    text = "明天的模拟课表";
  } else {
    const now = new Date();
    const cur = Core.periodAt(now);
    const mins = now.getHours() * 60 + now.getMinutes();
    const firstStart = Core.PERIODS[0].start.split(":").map(Number);
    const lastEnd = Core.PERIODS[Core.PERIODS.length - 1].end.split(":").map(Number);
    const beforeFirst = mins < firstStart[0] * 60 + firstStart[1];
    const afterLast = mins > lastEnd[0] * 60 + lastEnd[1];

    if (cur === state.period) text = "正在上这节课";
    else if (cur >= 0) text = state.period > cur ? "还没开始" : "今天已经结束";
    else if (beforeFirst) text = "还没到上课时间";
    else if (afterLast) text = "今天已下课";
    else text = "课间";
  }

  els.autoTip.textContent = text;
}

/* ---------- 6. AI 推荐 ---------- */

function currentFreeList() {
  return Core.freeRooms({
    dayStamp: dayStamp(),
    period: state.period,
    building: state.building,
    query: state.query,
    favs: state.favs,
  });
}

function showAI(text, isError = false) {
  els.aiOut.hidden = false;
  els.aiOut.textContent = text;
  els.aiOut.classList.toggle("error", isError);
}

/* 服务端代理地址：Key 存在服务器环境变量里，浏览器永远拿不到。
   留空字符串 = 不启用（退回"用户自己填 Key"或本地规则）。 */
const PROXY_URL = "/api/recommend";

const SYSTEM_PROMPT =
  "你是校园自习助手。用户会给一份空教室列表（格式：教室|楼|楼层|座位|标签|连空节数）和自己的偏好。" +
  "你只能从列表里挑一间，输出两行：第一行只写教室编号；第二行用不超过 60 字说明为什么适合，不要用列表符号。";

function setBusy(busy) {
  els.aiBtn.disabled = busy;
  els.aiBtn.textContent = busy ? "思考中…" : "推荐";
}

/** 把当前空教室压成紧凑文本，省 token 也更快 */
function roomLines(list) {
  return list.slice(0, 12).map(
    (r) => `${r.id}|${r.buildingName}|${r.floor}层|${r.seats}座|${r.tags.join("、") || "无标签"}|连空${r.free}节`
  );
}

async function askAI() {
  const list = currentFreeList();

  if (list.length === 0) {
    showAI("当前条件下没有空教室，先换个节次或楼栋再试。");
    return;
  }

  const need = els.need.value.trim();
  const lines = roomLines(list);

  setBusy(true);
  showAI("正在请求模型…");

  try {
    // ① 优先走服务端代理：Key 在服务器，浏览器里什么都没有
    if (PROXY_URL) {
      try {
        const res = await fetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ need, rooms: lines }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.text) {
          showAI(data.text);
          return;
        }
        console.warn("服务端代理不可用：", res.status, data.error || "");
      } catch (e) {
        console.warn("服务端代理请求失败：", e.message);
      }
    }

    // ② 本机自己填了 Key（只在本地调试时用）
    if (config.key) {
      showAI(await askWithOwnKey(need, lines));
      return;
    }

    // ③ 都没配 → 本地规则，断网也能演示
    const r = Core.recommend(list, need);
    showAI(
      `【本地推荐】服务端还没配置模型，以下是按规则算出来的结果：\n\n` +
        `${r.room.id}（${r.room.buildingName} ${r.room.floor} 层，${r.room.seats} 座）\n` +
        `理由：${r.reason}。\n\n` +
        `服务端配好 Key 之后，这里会直接变成模型的推荐，参观者不用做任何设置。`
    );
  } catch (err) {
    showAI("调用失败：" + err.message + "\n\n已切回本地推荐：\n" + formatLocal(list, need), true);
  } finally {
    setBusy(false);
  }
}

/** 用户自己在设置里填了 Key 时的直连方式（仅本地调试） */
async function askWithOwnKey(need, lines) {
  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `偏好：${need || "没有特别偏好，挑一间最合适的"}\n空教室：\n${lines.join("\n")}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`接口返回 ${res.status}（Key 无效、余额不足或地址写错）`);

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "模型没有返回内容，换个说法再试。";
}

function formatLocal(list, need) {
  const r = Core.recommend(list, need);
  return `${r.room.id}（${r.room.buildingName} ${r.room.floor} 层，${r.room.seats} 座）— ${r.reason}。`;
}

/* ---------- 7. 事件绑定 ---------- */

els.daySeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  state.dayOffset = Number(btn.dataset.day);
  renderDaySeg();
  renderRooms();
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderRooms();
});

els.favToggle.addEventListener("click", () => {
  state.onlyFav = !state.onlyFav;
  els.favToggle.classList.toggle("is-on", state.onlyFav);
  els.favToggle.textContent = (state.onlyFav ? "★" : "☆") + " 只看收藏";
  renderRooms();
});

els.aiBtn.addEventListener("click", askAI);

/* 教室详情 */
els.detailClose.addEventListener("click", closeDetail);

els.detailFav.addEventListener("click", () => {
  if (state.detailId) toggleFav(state.detailId);
});

els.detailModal.addEventListener("click", (e) => {
  if (e.target === els.detailModal) closeDetail();
});

els.need.addEventListener("keydown", (e) => {
  if (e.key === "Enter") askAI();
});

/* 设置面板 */
els.settingsBtn.addEventListener("click", () => {
  els.cfgEndpoint.value = config.endpoint;
  els.cfgModel.value = config.model;
  els.cfgKey.value = config.key;
  els.modal.hidden = false;
  els.cfgKey.focus();
});

els.settingsCancel.addEventListener("click", () => { els.modal.hidden = true; });

els.settingsSave.addEventListener("click", () => {
  config = {
    endpoint: els.cfgEndpoint.value.trim() || "https://api.deepseek.com/chat/completions",
    model: els.cfgModel.value.trim() || "deepseek-chat",
    key: els.cfgKey.value.trim(),
  };
  localStorage.setItem(CFG_KEY, JSON.stringify(config));
  els.modal.hidden = true;
  showAI(config.key ? "已保存。点「推荐」试试真实模型。" : "已清空 Key，当前使用本地推荐。");
});

els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) els.modal.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!els.detailModal.hidden) {
    closeDetail();
  } else if (!els.modal.hidden) {
    els.modal.hidden = true;
  }
});

/* ---------- 8. 启动 ---------- */
(function init() {
  const fromHash = readHash();
  const slot = Core.defaultSlot(new Date());

  state.dayOffset = fromHash && fromHash.dayOffset != null ? fromHash.dayOffset : slot.dayOffset;
  state.period = fromHash && fromHash.period != null ? fromHash.period : slot.period;
  state.building = (fromHash && fromHash.building) || "all";

  renderDaySeg();
  renderPeriods();
  renderBuildings();
  renderRooms();
  updateClock();
  setInterval(updateClock, 30000);
})();
