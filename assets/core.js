/* ============================================================
   空教室查询 — 数据与规则（core.js）
   这一层不碰页面，只有数据和计算。好处：
   1. 页面长什么样可以随便改，规则不受影响
   2. 可以单独用 Node 测试（见 README）
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;          // Node 里 require 用
  } else {
    root.Core = api;               // 浏览器里用 window.Core
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------- 1. 节次（改这里能改作息） ---------- */
  const PERIODS = [
    { label: "第 1-2 节", start: "08:00", end: "09:40", weight: 62 },
    { label: "第 3-4 节", start: "10:00", end: "11:40", weight: 56 },
    { label: "第 5-6 节", start: "14:00", end: "15:40", weight: 48 },
    { label: "第 7-8 节", start: "16:00", end: "17:40", weight: 40 },
    { label: "第 9-10 节", start: "19:00", end: "20:40", weight: 26 },
  ];

  /* ---------- 2. 楼栋（真实编号，来自大数据 2631 班课表） ---------- */
  let BUILDINGS = [
    { id: "wla", name: "WLA", note: "文理楼" },
    { id: "wlb", name: "WLB", note: "文理楼" },
    { id: "wlc", name: "WLC", note: "语音教室所在楼" },
    { id: "xxb", name: "XXB", note: "信息楼" },
    { id: "xxd", name: "XXD", note: "信息楼" },
    { id: "gxb", name: "GXB", note: "工训楼" },
    { id: "lib", name: "图书馆", note: "自习区，不排课" },
  ];

  /* ---------- 3. 教室 ----------
     编号规则：楼栋-房间号，房间号首位 = 楼层（WLA-310 在三层）
     带「语音室」标签的是语言实验室，WLC 的 (语) 就是这类教室。 */

  let ROOMS = [
    // WLA
    { id: "WLA-201", b: "wla", floor: 2, seats: 60, tags: ["空调"] },
    { id: "WLA-213", b: "wla", floor: 2, seats: 60, tags: ["空调", "投影"] },
    { id: "WLA-310", b: "wla", floor: 3, seats: 120, tags: ["空调", "投影", "插座"] },
    { id: "WLA-406", b: "wla", floor: 4, seats: 80, tags: ["空调", "插座"] },
    { id: "WLA-508", b: "wla", floor: 5, seats: 40, tags: ["插座"] },
    { id: "WLA-513", b: "wla", floor: 5, seats: 60, tags: ["空调"] },

    // WLB
    { id: "WLB-201", b: "wlb", floor: 2, seats: 60, tags: ["空调"] },
    { id: "WLB-302", b: "wlb", floor: 3, seats: 80, tags: ["空调", "投影"] },
    { id: "WLB-405", b: "wlb", floor: 4, seats: 40, tags: ["插座"] },

    // WLC（语音教室多）
    { id: "WLC-106", b: "wlc", floor: 1, seats: 40, tags: ["语音室", "空调"] },
    { id: "WLC-209", b: "wlc", floor: 2, seats: 40, tags: ["语音室", "插座"] },
    { id: "WLC-213", b: "wlc", floor: 2, seats: 40, tags: ["语音室", "空调"] },
    { id: "WLC-310", b: "wlc", floor: 3, seats: 60, tags: ["空调"] },

    // XXB
    { id: "XXB-108", b: "xxb", floor: 1, seats: 60, tags: ["空调"] },
    { id: "XXB-205", b: "xxb", floor: 2, seats: 120, tags: ["空调", "投影"] },
    { id: "XXB-302", b: "xxb", floor: 3, seats: 60, tags: ["插座"] },
    { id: "XXB-605", b: "xxb", floor: 6, seats: 80, tags: ["空调", "插座"] },
    { id: "XXB-607", b: "xxb", floor: 6, seats: 60, tags: ["空调"] },

    // XXD
    { id: "XXD-104", b: "xxd", floor: 1, seats: 100, tags: ["空调", "投影"] },
    { id: "XXD-205", b: "xxd", floor: 2, seats: 60, tags: ["空调"] },
    { id: "XXD-301", b: "xxd", floor: 3, seats: 40, tags: ["插座"] },

    // GXB
    { id: "GXB-204", b: "gxb", floor: 2, seats: 60, tags: ["插座"] },
    { id: "GXB-305", b: "gxb", floor: 3, seats: 40, tags: [] },
    { id: "GXB-410", b: "gxb", floor: 4, seats: 80, tags: ["空调", "投影", "插座"] },

    // 图书馆（自习区，不排课）
    { id: "图书馆-201", b: "lib", floor: 2, seats: 80, tags: ["安静", "空调", "插座"] },
    { id: "图书馆-202", b: "lib", floor: 2, seats: 60, tags: ["安静", "空调"] },
    { id: "图书馆-301", b: "lib", floor: 3, seats: 100, tags: ["安静", "空调", "插座"] },
    { id: "图书馆-302", b: "lib", floor: 3, seats: 40, tags: ["安静"] },
  ];

  /* ---------- 3.5 有真实数据就覆盖（沙河校区 380 间） ----------
     window.REAL_ROOMS 由教务处导出的教室列表生成，见 tools/import_rooms.py。
     hasClass === false 表示这间教室本周完全没有排课——这是导出时就确定的真实状态。 */
  const REAL = (typeof window !== "undefined" && window.REAL_ROOMS) || null;
  const ALWAYS_FREE = new Set();

  if (REAL && Array.isArray(REAL.rooms) && REAL.rooms.length) {
    BUILDINGS = REAL.buildings;
    ROOMS = REAL.rooms;
    REAL.rooms.forEach((r) => {
      if (r.hasClass === false) ALWAYS_FREE.add(r.id);
    });
  }

  /* ---------- 4. 排课模拟 ----------
     真实系统里这里应该读教务接口。现在用"确定性伪随机"：
     同一间教室 + 同一天 + 同一节次，永远算出同一个结果，
     所以刷新页面不会乱跳，看起来像真数据。 */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  /** 某教室在某天某节是否被占用 */
  function isOccupied(roomId, dayStamp, periodIndex) {
    // 本周完全没排课的教室，任何时段都空——真实数据，不是模拟
    if (ALWAYS_FREE.has(roomId)) return false;

    const weight = PERIODS[periodIndex].weight; // 早上课多、晚上课少
    const h = hash(roomId + "|" + dayStamp + "|" + periodIndex);
    return h % 100 < weight;
  }

  /** 从当前节次往后，连续空闲几节（最多数到当天最后一节） */
  function consecutiveFree(roomId, dayStamp, periodIndex) {
    let n = 0;
    for (let p = periodIndex; p < PERIODS.length; p++) {
      if (isOccupied(roomId, dayStamp, p)) break;
      n++;
    }
    return n;
  }

  /** 某间教室一整天每一节是否空闲：true = 空，false = 有课 */
  function daySchedule(roomId, dayStamp) {
    return PERIODS.map((_, i) => !isOccupied(roomId, dayStamp, i));
  }

  /** 当前时间落在第几节；不在任何节次内返回 -1 */
  function periodAt(now) {
    const mins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < PERIODS.length; i++) {
      const [sh, sm] = PERIODS[i].start.split(":").map(Number);
      const [eh, em] = PERIODS[i].end.split(":").map(Number);
      if (mins >= sh * 60 + sm && mins <= eh * 60 + em) return i;
    }
    return -1;
  }

  /**
   * 打开页面时该默认显示哪个时段：
   * 正在上课 → 当前节次
   * 课间/太早 → 下一个还没开始的节次
   * 都下课了 → 明天第一节
   */
  function defaultSlot(now) {
    const p = periodAt(now);
    if (p >= 0) return { dayOffset: 0, period: p, reason: "current" };

    const mins = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < PERIODS.length; i++) {
      const [sh, sm] = PERIODS[i].start.split(":").map(Number);
      if (mins < sh * 60 + sm) return { dayOffset: 0, period: i, reason: "next" };
    }
    return { dayOffset: 1, period: 0, reason: "tomorrow" };
  }

  /* ---------- 5. 查询 ---------- */

  /**
   * 查出空闲教室
   * @param {{dayStamp:number, period:number, building:string, query:string, favs:string[]}} opt
   */
  function freeRooms(opt) {
    const q = (opt.query || "").trim().toLowerCase();
    const favs = opt.favs || [];

    return ROOMS.filter((room) => {
      if (opt.building !== "all" && room.b !== opt.building) return false;
      if (opt.open24Only && !room.open24) return false;
      if (isOccupied(room.id, opt.dayStamp, opt.period)) return false;

      if (q) {
        const bName = buildingOf(room.b).name.toLowerCase();
        const hit = room.id.toLowerCase().includes(q) || bName.includes(q);
        if (!hit) return false;
      }
      return true;
    })
      .map((room) => ({
        ...room,
        buildingName: buildingOf(room.b).name,
        fav: favs.includes(room.id),
        free: consecutiveFree(room.id, opt.dayStamp, opt.period),
      }))
      .sort((x, y) => {
        if (x.fav !== y.fav) return x.fav ? -1 : 1;         // 收藏的排前面
        if (x.open24 !== y.open24) return x.open24 ? -1 : 1; // 24 小时开放的往前
        if (x.free !== y.free) return y.free - x.free;       // 能连空更久的往前
        return y.seats - x.seats;                            // 再按座位多
      });
  }

  function buildingOf(id) {
    return BUILDINGS.find((b) => b.id === id) || { id: id, name: id, note: "" };
  }

  /** 选中节次时的总览：共几间、空几间 */
  function stats(dayStamp, period) {
    const total = ROOMS.length;
    const free = ROOMS.filter((r) => !isOccupied(r.id, dayStamp, period)).length;
    return { total, free, busy: total - free };
  }

  /* ---------- 6. 没有 API 时的本地推荐 ----------
     有 Key 时走真模型，没 Key 时用这套规则，保证断网也能演示。 */

  function recommend(list, need) {
    if (!list.length) return null;
    const text = (need || "").toLowerCase();

    const wantsQuiet = /安静|静|自习/.test(text);
    const wantsPlug = /插座|充电|电脑/.test(text);
    const wantsCool = /空调|凉|热/.test(text);
    const seatMatch = text.match(/(\d+)\s*(人|个)/);
    const needSeats = seatMatch ? Number(seatMatch[1]) : 0;

    const scored = list.map((room) => {
      let score = 0;
      const tags = room.tags || [];
      if (wantsQuiet && tags.includes("安静")) score += 3;
      if (wantsPlug && tags.includes("插座")) score += 3;
      if (wantsCool && tags.includes("空调")) score += 2;
      if (needSeats && room.seats >= needSeats) score += 3;
      if (needSeats && room.seats > needSeats * 3) score -= 1; // 太小猫用大屋子
      score += Math.min(room.free, 4) * 0.5;                   // 能连空更久更加分
      return { room, score };
    });

    scored.sort((a, b) => b.score - a.score || b.room.seats - a.room.seats);
    const best = scored[0].room;

    const why = [];
    if (wantsQuiet && best.tags.includes("安静")) why.push("在图书馆区域，安静");
    if (wantsPlug && best.tags.includes("插座")) why.push("有插座");
    if (needSeats) why.push(`能坐 ${best.seats} 人，够你说的 ${needSeats} 人`);
    why.push(`接下来 ${best.free} 节都空`);

    return { room: best, reason: why.join("，") };
  }

  return {
    PERIODS,
    BUILDINGS,
    ROOMS,
    isOccupied,
    consecutiveFree,
    daySchedule,
    periodAt,
    defaultSlot,
    freeRooms,
    stats,
    recommend,
    buildingOf,
  };
});
