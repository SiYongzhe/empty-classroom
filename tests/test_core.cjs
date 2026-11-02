/* 逻辑测试：在 axiom-starter 目录运行  node tests/test_core.cjs
   只测 core.js，不需要浏览器。改完数据和规则先跑这个，再打开页面看。 */
const fs = require("fs");
const path = require("path");

const CORE = path.join(__dirname, "..", "assets", "core.js");
const src = fs.readFileSync(CORE, "utf8");
const mod = { exports: {} };
new Function("module", "exports", src)(mod, mod.exports);
const Core = mod.exports;

let fail = 0;
function ok(cond, msg) {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) fail++;
}

const stamp = 20261113;
const day2 = 20261114;

console.log("[1] 数据完整性");
ok(Core.ROOMS.length === 28, "教室数量 = " + Core.ROOMS.length);
ok(new Set(Core.ROOMS.map((r) => r.id)).size === Core.ROOMS.length, "教室编号无重复");
ok(Core.ROOMS.every((r) => Core.BUILDINGS.some((b) => b.id === r.b)), "每间教室的楼栋都存在");
ok(Core.ROOMS.every((r) => r.seats > 0), "座位数都大于 0");
ok(Core.PERIODS.length === 5, "五个节次");

console.log("[2] 排课是确定性的（刷新不乱跳）");
ok(Core.isOccupied("WLA-310", stamp, 2) === Core.isOccupied("WLA-310", stamp, 2), "同教室同天同节结果一致");
const changed = Core.ROOMS.filter(
  (r) => Core.isOccupied(r.id, stamp, 1) !== Core.isOccupied(r.id, day2, 1)
).length;
ok(changed >= 2, "换个日期后至少 2 间教室状态变化（实际 " + changed + " 间）");

console.log("[3] 空置率合理");
let ratios = [];
for (let p = 0; p < 5; p++) {
  const st = Core.stats(stamp, p);
  ratios.push(st.free / st.total);
  console.log("    第 " + (p + 1) + " 节：空 " + st.free + "/" + st.total);
}
ok(ratios.every((r) => r > 0.1 && r < 0.9), "每节空置率都在 10%–90% 之间");
ok(ratios[4] > ratios[0], "晚上比早上空（符合直觉）");

console.log("[4] 查询过滤");
const all = Core.freeRooms({ dayStamp: stamp, period: 2, building: "all", query: "", favs: [] });
ok(all.length > 0, "全部楼栋有空教室（" + all.length + " 间）");
const one = Core.freeRooms({ dayStamp: stamp, period: 2, building: "wla", query: "", favs: [] });
ok(one.every((r) => r.b === "wla"), "按楼栋筛选生效");
const sampleId = all[0].id;
const q = Core.freeRooms({ dayStamp: stamp, period: 2, building: "all", query: sampleId, favs: [] });
ok(q.length === 1 && q[0].id === sampleId, "按教室号精确搜索生效");

console.log("[5] 收藏置顶");
const firstId = all[0].id;
const faved = Core.freeRooms({ dayStamp: stamp, period: 2, building: "all", query: "", favs: [firstId] });
ok(faved[0].id === firstId && faved[0].fav === true, "收藏的教室排第一");

console.log("[6] 连续空闲节数");
ok(all[0].free >= 1, "连空节数 >= 1（" + all[0].free + "）");
const lastList = Core.freeRooms({ dayStamp: stamp, period: 4, building: "all", query: "", favs: [] });
ok(lastList.length === 0 || lastList[0].free === 1, "最后一节最多只算 1 节");

console.log("[7] 时间推断");
function at(h, m) { return new Date(2026, 10, 13, h, m); }
ok(Core.periodAt(at(8, 30)) === 0, "08:30 在第 1 节");
ok(Core.periodAt(at(11, 50)) === -1, "11:50 处于课间");
ok(Core.periodAt(at(22, 0)) === -1, "22:00 已下课");
ok(Core.defaultSlot(at(9, 0)).period === 0, "上课时间默认当前节");
ok(Core.defaultSlot(at(11, 50)).reason === "next", "课间默认下一节");
ok(Core.defaultSlot(at(23, 0)).reason === "tomorrow", "深夜默认明天");
ok(Core.defaultSlot(at(7, 0)).period === 0, "早上 7 点默认第一节");

console.log("[8] 本地推荐");
const pool = Core.freeRooms({ dayStamp: stamp, period: 2, building: "all", query: "", favs: [] });
const r1 = Core.recommend(pool, "要安静，有插座");
ok(r1 && r1.room.tags.includes("安静"), "要安静时挑到安静的教室（" + (r1 && r1.room.id) + "）");
const r2 = Core.recommend(pool, "能坐 100 个人");
ok(r2 && r2.room.seats >= 100, "要 100 人时挑到 " + (r2 && r2.room.seats) + " 座");
ok(Core.recommend([], "随便") === null, "没有空教室时返回 null");

console.log("[9] 全天时间轴");
const sched = Core.daySchedule("WLA-310", stamp);
ok(sched.length === Core.PERIODS.length, "一天有 " + sched.length + " 格");
ok(sched.every((v) => typeof v === "boolean"), "每格都是布尔值");
const manual = Core.PERIODS.map((_, i) => !Core.isOccupied("WLA-310", stamp, i));
ok(JSON.stringify(sched) === JSON.stringify(manual), "与 isOccupied 的结论一致");
const mixed = Core.ROOMS.filter((r) => {
  const s = Core.daySchedule(r.id, stamp);
  return s.includes(true) && s.includes(false);
}).length;
ok(mixed > 0, "存在「有课也有空」的教室（" + mixed + " 间），时间轴不会全绿或全灰");

console.log(fail === 0 ? "\n全部通过" : "\n有 " + fail + " 项失败");
process.exit(fail === 0 ? 0 : 1);
