// 验证真实数据接入：模拟浏览器环境，加载 rooms-real.js + core.js
const fs = require("fs");
const path = require("path");

const ROOT = "C:\\Users\\22170\\Desktop\\qq-bridge-main\\axiom-starter";
const sandbox = { window: {} };
const ctx = { window: sandbox.window, console, module: { exports: {} }, exports: {} };

// 1. rooms-real.js 会写 window.REAL_ROOMS
new Function("window", fs.readFileSync(path.join(ROOT, "assets", "rooms-real.js"), "utf8"))(
  sandbox.window
);
console.log("REAL_ROOMS 教室数:", sandbox.window.REAL_ROOMS.rooms.length);
console.log("楼栋数:", sandbox.window.REAL_ROOMS.buildings.length);

// 2. core.js 用同一份 window
const coreFactory = new Function(
  "window",
  "module",
  "exports",
  fs.readFileSync(path.join(ROOT, "assets", "core.js"), "utf8")
);
const mod = { exports: {} };
coreFactory(sandbox.window, mod, mod.exports);
const Core = mod.exports;

let fail = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) fail++;
};

console.log("[真实数据]");
ok(Core.ROOMS.length === 380, "教室数 = " + Core.ROOMS.length);
ok(Core.BUILDINGS.length === 12, "楼栋数 = " + Core.BUILDINGS.length);
ok(
  Core.ROOMS.every((r) => r.b && typeof r.seats === "number"),
  "每间教室都有楼栋和座位数"
);
ok(new Set(Core.ROOMS.map((r) => r.id)).size === Core.ROOMS.length, "教室编号无重复");

const noClass = Core.ROOMS.filter((r) => r.hasClass === false);
console.log("  本周无课:", noClass.length, "间");

// 3. 无课教室在所有时段都必须空闲
const stamp = 20261103;
let alwaysFreeOk = true;
for (const r of noClass.slice(0, 20)) {
  for (let p = 0; p < 5; p++) {
    if (Core.isOccupied(r.id, stamp, p)) alwaysFreeOk = false;
  }
}
ok(alwaysFreeOk, "本周无课的教室，5 个时段全部空闲");

// 4. 有课教室仍按模拟分布，且不会全空/全满
const withClass = Core.ROOMS.filter((r) => r.hasClass === true);
let occ = 0,
  tot = 0;
for (const r of withClass) {
  for (let p = 0; p < 5; p++) {
    tot++;
    if (Core.isOccupied(r.id, stamp, p)) occ++;
  }
}
const ratio = occ / tot;
console.log("  有课教室占用率:", (ratio * 100).toFixed(1) + "%");
ok(ratio > 0.2 && ratio < 0.8, "占用率在合理区间");

// 5. 查询与统计
const st = Core.stats(stamp, 0);
console.log("  第 1 节：空", st.free, "/", st.total);
ok(st.total === 380, "统计总数 = 380");
const list = Core.freeRooms({ dayStamp: stamp, period: 0, building: "all", query: "", favs: [] });
ok(list.length === st.free, "列表数与统计一致");
ok(list.every((r) => r.buildingName), "每张卡片都有楼栋名");

console.log(fail === 0 ? "\n全部通过" : "\n有 " + fail + " 项失败");
process.exit(fail === 0 ? 0 : 1);
