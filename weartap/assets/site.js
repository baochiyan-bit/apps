// ウェアタップ LP：ページ全体が「ある1日」。
// スクロール位置から時刻を連続で出し、24時間の文字盤・電話の画面（ロック画面／アプリ／ウィジェット／カレンダー）・
// スマホ用の帯を、同じ記録（OUTS）から描く。画面の数字はすべてここで計算するので、文字盤と食い違わない。
(() => {
  const OUTS = [[432, 461], [740, 778], [910, 925], [1170, 1215]]; // 7:12–7:41, 12:20–12:58, 15:10–15:25, 19:30–20:15
  const BUDGET = 120, GOAL = 1320;                                  // 目標22時間 → 外せるのは2時間
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const UI = JSON.parse(document.getElementById("ui")?.textContent || "{}");
  const ja = document.documentElement.lang === "ja";
  const NS = "http://www.w3.org/2000/svg";
  const p2 = n => String(Math.floor(n)).padStart(2, "0");
  const hm = m => `${Math.floor(m / 60)}:${p2(m % 60)}`;                       // 21:53
  const clock = m => (m >= 1440 ? "24:00" : `${p2(m / 60)}:${p2(m % 60)}`);   // 07:12
  const hms = s => `${Math.floor(s / 3600)}:${p2(s % 3600 / 60)}:${p2(s % 60)}`;
  const cd = s => (s >= 3600 ? hms(s) : `${Math.floor(s / 60)}:${p2(s % 60)}`); // アプリと同じ：1時間未満は分:秒
  const tod = m => {                                                             // 時刻の表示（日本語は 7:12、英語は 7:12 AM）
    m = Math.floor(m) % 1440;
    const h = Math.floor(m / 60), mm = p2(m % 60);
    return ja ? `${h}:${mm}` : `${(h % 12) || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fill = (tpl, v) => tpl.replace("{x}", v);

  /** その時刻までに外していた分数と、いまの状態 */
  function stateAt(t) {
    let used = 0, out = null;
    for (const [s, e] of OUTS) {
      if (t < s) break;
      used += Math.min(t, e) - s;
      if (t < e) out = s;
    }
    return { used, out, over: out !== null && used >= BUDGET, worn: t - used };
  }

  // ---------- 小さな部品 ----------
  const ic = {
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 16.5v-9M8 11l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v9M8 13l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mouth: '<svg viewBox="0 0 24 24"><path d="M3.5 10.5c2.6 3.6 5.5 5.2 8.5 5.2s5.9-1.6 8.5-5.2M3.5 10.5c2.8-1.4 5.6-2 8.5-.8 2.9-1.2 5.7-.6 8.5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bars: '<svg viewBox="0 0 34 12"><rect x="0" y="8" width="3.4" height="4" rx="1"/><rect x="5" y="5.5" width="3.4" height="6.5" rx="1"/><rect x="10" y="3" width="3.4" height="9" rx="1"/><rect x="15" y="0" width="3.4" height="12" rx="1"/><rect x="22" y="1" width="10" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="23.6" y="2.6" width="6.8" height="6.8" rx="1.4"/></svg>',
    tabs: ['<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>',
      '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 9.5h17" stroke="currentColor" stroke-width="2"/></svg>',
      '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="3" fill="currentColor"/></svg>',
      '<svg viewBox="0 0 24 24"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>'],
  };
  const ring = (p, color) => {
    const c = 2 * Math.PI * 42;
    return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" class="rg-track" stroke-width="8"/>` +
      `<circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="${(c * Math.min(1, p)).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
  };
  const dateLabel = () => new Date().toLocaleDateString(ja ? "ja-JP" : "en-US", ja ? { month: "long", day: "numeric", weekday: "short" } : { weekday: "short", month: "short", day: "numeric" })
    .replace(/\((.)\)$/, "($1)");
  const statusBar = t => `<div class="sb"><span class="tnum">${tod(t).replace(/ [AP]M$/, "")}</span><i></i>${ic.bars}</div>`;

  // ---------- 電話の画面 ----------
  /** ロック画面（ヒーロー）：時計、外し中のカード、ダイナミックアイランド */
  function renderLock(el, t, sec) {
    const s = stateAt(t);
    const left = Math.max(0, Math.round((BUDGET - s.used) * 60 - sec));
    el.querySelector(".lk-time").textContent = tod(t).replace(/ [AP]M$/, "");
    el.querySelectorAll("[data-left]").forEach(n => n.textContent = "short" in n.dataset ? cd(left) : hms(left));
    const since = el.querySelector(".lk-since");
    if (since && s.out !== null) since.textContent = fill(UI.since, tod(s.out));
  }

  /** アプリのホーム画面：装着中（リング）／外し中（残り時間）／超過（赤） */
  function renderApp(el, t, sec) {
    const s = stateAt(t);
    const leftSec = Math.max(0, Math.round((BUDGET - s.used) * 60 - sec));
    let body;
    if (s.out === null) {
      body = `<div class="ap-ring">${ring(s.worn / GOAL, "var(--app-tint)")}<div><small>${esc(UI.wornToday)}</small><b class="tnum">${hm(Math.floor(s.worn))}</b><small>${esc(UI.goal)}</small></div></div>
        <div class="ap-sub tnum">${esc(fill(UI.leftToday, hms(leftSec)))}</div><div class="ap-sub2">${esc(UI.tray)}</div>
        <div class="ap-btn in">${ic.up}<span>${esc(UI.takeOut)}</span></div>`;
    } else {
      const overSec = Math.max(0, Math.round((s.used - BUDGET) * 60 + sec));
      body = `<div class="ap-since tnum">${esc(fill(UI.outSince, tod(s.out)))}</div>
        <div class="ap-lab${s.over ? " red" : ""}">${esc(s.over ? UI.over : UI.untilBack)}</div>
        <b class="ap-cd tnum${s.over ? " red" : ""}">${cd(s.over ? overSec : leftSec)}</b>
        <div class="ap-back">${esc(UI.backdate)}</div>
        <div class="ap-chips">${UI.chips.map(c => `<span>${esc(c)}</span>`).join("")}</div>
        <div class="ap-btn ${s.over ? "over" : "out"}">${ic.down}<span>${esc(UI.putBack)}</span></div>`;
    }
    const rows = OUTS.filter(([a]) => a <= t).reverse().slice(0, 3).map(([a, e]) => {
      const ongoing = t < e;
      return `<div class="ap-row tnum"><span>${tod(a)} – ${ongoing ? `<em>${esc(UI.now)}</em>` : tod(e)}</span><span>${hm(Math.floor(Math.min(t, e) - a))}</span></div>`;
    }).join("");
    el.innerHTML = `${statusBar(t)}<div class="ap-hd"><i>${ic.gear}</i><b>${esc(dateLabel())}</b></div>
      <div class="ap-main">${body}</div>
      <div class="ap-list"><h4>${esc(UI.today)}</h4><div class="ap-cols"><span>${esc(UI.cols[0])}</span><span>${esc(UI.cols[1])}</span></div>${rows}</div>
      <div class="ap-tab">${ic.tabs.map((svg, i) => `<span class="${i ? "" : "on"}">${svg}<small>${esc(UI.tabs[i])}</small></span>`).join("")}</div>`;
  }

  /** ホーム画面のウィジェット（小と中） */
  function renderWidgets(el, t, sec) {
    const s = stateAt(t), out = s.out !== null;
    const leftSec = Math.max(0, Math.round((BUDGET - s.used) * 60 - sec));
    const head = `<div class="wg-h">${out ? `<i class="o">${ic.mouth}</i>` : `<i class="w">${ic.check}</i>`}<b>${esc(out ? UI.w.out : UI.w.in)}</b></div>`;
    const val = out ? `<b class="wg-v tnum">${cd(leftSec)}</b><small>${esc(UI.w.toBack)}</small>` : `<b class="wg-v tnum">${hm(Math.floor(s.worn))}</b><small>${esc(UI.wornToday)}</small>`;
    const btn = `<span class="wg-btn">${esc(out ? UI.putBack : UI.takeOut)}</span>`;
    const tiles = [["#FFB21E", "#FF8A00"], ["#FF5A5F", "#E53950"], ["#8E8E93", "#5C5C61"], ["#3DDC84", "#1FB86A"], ["#E05BD8", "#B03FD0"], ["#FF4D6D", "#E8263F"], ["#F2A65A", "#C9782F"], ["#A1A1A6", "#6E6E73"]];
    const tile = i => `<i class="wg-tile" style="background:linear-gradient(${tiles[i][0]},${tiles[i][1]})"></i>`;
    el.innerHTML = `${statusBar(t)}<div class="wg">
      <div class="wg-row"><div class="wg-s">${head}${val}${btn}</div><div class="wg-grid">${tile(0)}${tile(1)}${tile(2)}${tile(3)}</div></div>
      <div class="wg-m"><div class="wg-ring">${ring(s.worn / GOAL, out ? "var(--out)" : "var(--app-tint)")}<div><b class="tnum">${hm(Math.floor(s.worn))}</b><small>${esc(UI.w.worn)}</small></div></div>
        <div class="wg-mr">${head}${out ? `<b class="wg-v tnum">${cd(leftSec)}</b><small>${esc(UI.w.toBack)}</small>` : `<small>${esc(UI.goal)}</small>`}${btn}</div></div>
      <div class="wg-row4">${tile(4)}${tile(5)}${tile(6)}${tile(7)}</div>
      <div class="wg-dock">${["#34C759", "#0A84FF", "#30D158", "#5E5CE6"].map(c => `<i class="wg-tile" style="background:${c}"></i>`).join("")}</div>
    </div>`;
  }

  /** カレンダー：今月。今日は「惜しい」（21:53） */
  function renderCalendar(el, t) {
    const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), today = now.getDate();
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    let seed = y * 100 + mo, met = 0, counted = 0, sum = 0;
    const rnd = n => { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); };
    const cells = [];
    for (let i = 0; i < first; i++) cells.push("<i></i>");
    for (let d = 1; d <= days; d++) {
      let cls = "fu", v = "";
      if (d < today) {
        const r = rnd(10);
        const m = r === 0 ? 1150 + rnd(60) : r < 3 ? 1240 + rnd(70) : 1322 + rnd(35);
        cls = m >= GOAL ? "met" : m >= 1200 ? "al" : "mi"; v = hm(m); counted++; sum += m; if (m >= GOAL) met++;
      } else if (d === today) { cls = "al now"; v = "21:53"; counted++; sum += 1313; }
      cells.push(`<span class="${cls}"><b>${d}</b>${v ? `<small>${v}</small>` : ""}</span>`);
    }
    const avg = counted ? Math.round(sum / counted) : 0;
    const monthLabel = now.toLocaleDateString(ja ? "ja-JP" : "en-US", { year: "numeric", month: "long" });
    el.innerHTML = `${statusBar(t)}<div class="cl">
      <div class="cl-hd"><b>${esc(UI.cal.title)}</b></div>
      <div class="cl-mo"><i>‹</i><b>${esc(monthLabel)}</b><i>›</i></div>
      <div class="cl-wd">${UI.cal.wd.map(w => `<span>${esc(w)}</span>`).join("")}</div>
      <div class="cl-grid">${cells.join("")}</div>
      <div class="cl-lg"><span class="met"></span>${esc(UI.cal.lg[0])}<span class="al"></span>${esc(UI.cal.lg[1])}<span class="mi"></span>${esc(UI.cal.lg[2])}</div>
      <div class="cl-rows"><div><span>${esc(UI.cal.avg[0])}</span><small class="tnum">${esc(fill(UI.cal.met, `${met} / ${counted}`))}</small><b class="tnum">${hm(avg)}</b></div>
        <div><span>${esc(UI.cal.avg[1])}</span><b class="tnum">22:06</b></div></div>
    </div>
    <div class="ap-tab">${ic.tabs.map((svg, i) => `<span class="${i === 1 ? "on" : ""}">${svg}<small>${esc(UI.tabs[i])}</small></span>`).join("")}</div>`;
  }

  const RENDER = { lock: renderLock, app: renderApp, widgets: renderWidgets, calendar: renderCalendar };
  function paint(screen, kind, t, sec) {
    const layer = screen.querySelector(`[data-kind="${kind}"]`);
    if (layer) RENDER[kind](layer, t, sec);
  }

  // ---------- 文字盤 ----------
  const svg = document.querySelector(".dial svg");
  let drawDial = () => {};
  if (svg) {
    const C = 200, R = 160, W = 22;
    const pt = (m, r = R) => { const a = m / 1440 * Math.PI * 2 - Math.PI / 2; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
    const arc = (a, b) => {
      if (b - a >= 1440) b = a + 1439.99;
      const [x1, y1] = pt(a), [x2, y2] = pt(b);
      return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${b - a > 720 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    };
    const el = (name, attrs, parent = svg) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
    el("circle", { class: "track", cx: C, cy: C, r: R, fill: "none", "stroke-width": W });
    for (let h = 0; h < 24; h++) {
      const [x1, y1] = pt(h * 60, R + W / 2 + 6), [x2, y2] = pt(h * 60, R + W / 2 + (h % 6 ? 11 : 17));
      el("line", { class: "tick", x1, y1, x2, y2, "stroke-width": h % 6 ? 1 : 1.6, "stroke-linecap": "round" });
      if (h % 6 === 0) {
        const [x, y] = pt(h * 60, R + W / 2 + 34);
        el("text", { class: "hour", x, y, "text-anchor": "middle", "dominant-baseline": "central" }).textContent = String(h);
      }
    }
    const g = el("g", {});
    const hand = el("circle", { class: "hand", r: 7 });
    const handRing = el("circle", { class: "hand-ring", r: 15, opacity: .35 });
    const ro = document.querySelector(".readout");
    const q = s => ro.querySelector(s);
    drawDial = t => {
      g.replaceChildren();
      el("path", { class: "seg-worn", d: arc(0, Math.max(t, .01)), fill: "none", "stroke-width": W }, g);
      let used = 0;
      for (const [s, e] of OUTS) {
        if (t <= s) break;
        const end = Math.min(t, e), room = Math.max(0, BUDGET - used);
        if (end - s <= room) el("path", { class: "seg-out", d: arc(s, end), fill: "none", "stroke-width": W }, g);
        else {
          if (room > 0) el("path", { class: "seg-out", d: arc(s, s + room), fill: "none", "stroke-width": W }, g);
          el("path", { class: "seg-over", d: arc(s + room, end), fill: "none", "stroke-width": W }, g);
        }
        used += end - s;
      }
      const [x, y] = pt(t);
      hand.setAttribute("cx", x); hand.setAttribute("cy", y);
      handRing.setAttribute("cx", x); handRing.setAttribute("cy", y);
      const s = stateAt(t);
      q(".clock").textContent = clock(t);
      q("[data-v-out]").textContent = hm(Math.floor(s.used));
      q("[data-v-left]").textContent = hm(Math.max(0, Math.ceil(BUDGET - s.used)));
      q("[data-v-worn]").textContent = hm(Math.floor(s.worn));
      const end = t >= 1440;
      ro.querySelectorAll("[data-left-row]").forEach(n => n.hidden = end);
      ro.querySelectorAll("[data-worn-row]").forEach(n => n.hidden = !end);
      const key = s.over ? "over" : s.out !== null ? "out" : "in", st = q(".state");
      st.dataset.s = key;
      st.querySelector("span").textContent = st.dataset[key];
    };
  }

  // ---------- スマホ用の帯 ----------
  const bar = document.querySelector(".daybar");
  function drawBar(t) {
    if (!bar) return;
    const s = stateAt(t), key = s.over ? "over" : s.out !== null ? "out" : "in";
    bar.querySelector(".db-clock").textContent = clock(t);
    const bs = bar.querySelector(".db-state");
    bs.dataset.s = key;
    bs.querySelector("span").textContent = bs.dataset[key];
    bar.querySelector(".db-left").textContent = t >= 1440 ? `${bar.dataset.worn} ${hm(Math.floor(s.worn))}` : `${bar.dataset.left} ${hm(Math.max(0, Math.ceil(BUDGET - s.used)))}`;
    const pct = m => (m / 1440 * 100).toFixed(3) + "%";
    let html = `<i class="w" style="left:0;width:${pct(t)}"></i>`, used = 0;
    for (const [a, e] of OUTS) {
      if (t <= a) break;
      const end = Math.min(t, e), room = Math.max(0, BUDGET - used), okEnd = Math.min(end, a + room);
      if (okEnd > a) html += `<i class="o" style="left:${pct(a)};width:${pct(okEnd - a)}"></i>`;
      if (end > okEnd) html += `<i class="x" style="left:${pct(okEnd)};width:${pct(end - okEnd)}"></i>`;
      used += end - a;
    }
    bar.querySelector(".db-track").innerHTML = html;
  }

  // ---------- スクロールから時刻を出す ----------
  const stage = document.querySelector(".stage");
  const stageScreen = stage?.querySelector(".screen");
  const steps = [...document.querySelectorAll(".step[data-t]")];
  const daySec = document.querySelector(".day");
  let anchors = [];
  function measure() {
    anchors = steps.map(s => {
      const r = s.getBoundingClientRect();
      return { y: r.top + scrollY + r.height / 2 - innerHeight / 2, t: +s.dataset.t, kind: s.dataset.kind, dark: s.classList.contains("is-dark") };
    });
  }
  function timeAt(y) {
    if (!anchors.length) return 0;
    if (y <= anchors[0].y) return anchors[0].t;
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1], b = anchors[i];
      if (y <= b.y) {
        const k = (y - a.y) / (b.y - a.y);
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // 場面の近くでは時間がゆっくり進む
        return a.t + (b.t - a.t) * e;
      }
    }
    return anchors[anchors.length - 1].t;
  }
  function nearest(y) {
    let best = anchors[0];
    for (const a of anchors) if (Math.abs(a.y - y) < Math.abs(best.y - y)) best = a;
    return best;
  }

  let intro = reduce ? 1 : 0, idleSec = 0, lastT = -1, lastKind = "";
  function frame() {
    const y = scrollY;
    let t = timeAt(y);
    if (intro < 1) t = t * (1 - Math.pow(1 - intro, 3)); // 読み込み時：0:00 から最初の場面まで針が進む
    const tShown = Math.min(1440, t + idleSec / 60);
    const near = nearest(y) || { kind: "lock", dark: false };
    drawDial(tShown);
    drawBar(tShown);
    if (stageScreen) {
      if (near.kind !== lastKind) {
        stageScreen.querySelectorAll("[data-kind]").forEach(l => l.classList.toggle("on", l.dataset.kind === near.kind));
        lastKind = near.kind;
      }
      stage.classList.toggle("is-dark", near.dark);
      stageScreen.classList.toggle("dark", near.dark);
      paint(stageScreen, near.kind, tShown, idleSec % 60);
    }
    if (Math.abs(t - lastT) > .01) idleSec = 0;
    lastT = t;
  }
  let raf = 0;
  const request = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); }); };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", () => { measure(); request(); });
  addEventListener("load", () => { measure(); request(); });
  measure();
  frame();
  if (!reduce) {
    const t0 = performance.now();
    const run = now => { intro = Math.min(1, (now - t0 - 300) / 1500); if (intro < 0) intro = 0; frame(); if (intro < 1) requestAnimationFrame(run); };
    requestAnimationFrame(run);
    // 止まっている間は、秒が進む（本物の画面と同じく、残り時間が1秒ずつ減る）
    setInterval(() => { if (intro >= 1 && document.visibilityState === "visible") { idleSec++; frame(); } }, 1000);
  }

  // スマホ：各場面の電話は、その場面の時刻で1回描く
  document.querySelectorAll(".inline-shot .screen[data-kind]").forEach(sc => {
    const kind = sc.dataset.kind, t = +sc.dataset.t;
    sc.innerHTML = `<div class="layer${kind === "lock" ? " lock" : ""} on" data-kind="${kind}">${kind === "lock" ? stage?.querySelector('[data-kind="lock"]')?.innerHTML || "" : ""}</div>`;
    paint(sc, kind, t, 0);
  });

  // スマホ用の帯は、1日の章を読んでいる間だけ出す
  if (bar && daySec) {
    const toggle = () => { const r = daySec.getBoundingClientRect(); bar.classList.toggle("show", r.top < innerHeight * .25 && r.bottom > innerHeight * .9); };
    addEventListener("scroll", toggle, { passive: true }); toggle();
  }

  // ---------- 見出しの帯の色 ----------
  const hd = document.querySelector(".hd");
  const nights = [...document.querySelectorAll("[data-tone=night]")];
  let ticking = false;
  function tone() {
    ticking = false;
    const y = 30;
    let dark = nights.some(n => { const r = n.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    if (!dark && daySec) {
      const r = daySec.getBoundingClientRect(), f = (y - r.top) / r.height;
      dark = f > .655 && f < 1;
    }
    hd.classList.toggle("is-night", dark);
    hd.classList.toggle("is-scrolled", scrollY > 8);
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(tone); } }, { passive: true });
  tone();
})();

// 入り口の章：ダイナミックアイランドとロック画面のカードの残り時間を、本物と同じく1秒ずつ減らす
(() => {
  const els = [...document.querySelectorAll(".island [data-countdown]")];
  if (!els.length) return;
  const t0 = Date.now();
  const p2 = n => String(n).padStart(2, "0");
  const tick = () => {
    els.forEach(el => {
      const left = Math.max(0, +el.dataset.countdown - Math.floor((Date.now() - t0) / 1000));
      const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
      el.textContent = el.closest(".pill") ? `${h ? h + ":" + p2(m) : m}:${p2(s)}` : `${h}:${p2(m)}:${p2(s)}`;
    });
  };
  tick();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(tick, 1000);
})();

// ロック画面の日付は、見ている日にする
document.querySelectorAll("[data-today]").forEach(el => {
  const ja = document.documentElement.lang === "ja";
  el.textContent = new Date().toLocaleDateString(ja ? "ja-JP" : "en-US", ja ? { month: "long", day: "numeric", weekday: "long" } : { weekday: "long", month: "long", day: "numeric" });
});
