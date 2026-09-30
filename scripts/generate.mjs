import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const USER = process.env.PROFILE_USER ?? "dariomatias-dev";
const OUT = process.env.OUT_DIR ?? "assets";
const TOKEN =
  process.env.GH_TOKEN ??
  process.env.GITHUB_TOKEN ??
  execSync("gh auth token").toString().trim();

const W = 840;
const theme = {
  bg: "#1a1b27",
  title: "#70a5fd",
  text: "#38bdae",
  label: "#a9b1d6",
  icon: "#bf91f3",
  accent: "#70a5fd",
  empty: "#24283b",
  heat: ["#24283b", "#1e3a6e", "#2d5bb5", "#4f8ef0", "#9ec5ff"],
};
// Markup, build files and generated platform scaffolding that say nothing about what is written by hand.
const EXCLUDED_LANGS = new Set(
  (process.env.EXCLUDE_LANGS ??
    "MDX,CMake,C++,C,Makefile,Dockerfile,Shell,Swift,Objective-C,Ruby,PowerShell,Batchfile,HTML,CSS,SCSS")
    .split(",")
    .map((l) => l.trim()),
);
const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif";

const LOCALES = {
  en: {
    locale: "en-US",
    statsAlt: `${USER} GitHub statistics`,
    total: "Total Contributions",
    present: "Present",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
    noStreak: "No active streak",
    lastYear: "Last 12 months",
    activeDays: "Active days",
    bestDay: "Best day",
    commits: "Commits",
    prs: "Pull Requests",
    reviews: "Reviews",
    stars: "Stars",
    followers: "Followers",
    activityTitle: "Contribution Activity",
    activitySub: (n) => `${n} contributions in the last year`,
    activityAlt: `${USER} contribution activity`,
    cellTip: (n, date) => `${n} contributions on ${date}`,
    weekly: "Weekly",
    peak: (n) => `Peak week: ${n} contributions`,
    mostDay: "Most active day",
    mostMonth: "Most active month",
    less: "Less",
    more: "More",
    langsTitle: "Most Used Languages",
    langsSub: "by code size, own repositories, excluding markup and generated code",
    langsAlt: `${USER} most used languages`,
    other: "Other",
  },
  es: {
    locale: "es-ES",
    statsAlt: `Estadísticas de GitHub de ${USER}`,
    total: "Contribuciones totales",
    present: "Presente",
    currentStreak: "Racha actual",
    longestStreak: "Racha más larga",
    noStreak: "Sin racha activa",
    lastYear: "Últimos 12 meses",
    activeDays: "Días activos",
    bestDay: "Mejor día",
    commits: "Commits",
    prs: "Pull Requests",
    reviews: "Revisiones",
    stars: "Estrellas",
    followers: "Seguidores",
    activityTitle: "Actividad de contribuciones",
    activitySub: (n) => `${n} contribuciones en el último año`,
    activityAlt: `Actividad de contribuciones de ${USER}`,
    cellTip: (n, date) => `${n} contribuciones el ${date}`,
    weekly: "Semanal",
    peak: (n) => `Semana pico: ${n} contribuciones`,
    mostDay: "Día más activo",
    mostMonth: "Mes más activo",
    less: "Menos",
    more: "Más",
    langsTitle: "Lenguajes más usados",
    langsSub: "por tamaño de código, repositorios propios, sin marcado ni código generado",
    langsAlt: `Lenguajes más usados de ${USER}`,
    other: "Otros",
  },
  "pt-BR": {
    locale: "pt-BR",
    statsAlt: `Estatísticas do GitHub de ${USER}`,
    total: "Contribuições totais",
    present: "Presente",
    currentStreak: "Sequência atual",
    longestStreak: "Maior sequência",
    noStreak: "Sem sequência ativa",
    lastYear: "Últimos 12 meses",
    activeDays: "Dias ativos",
    bestDay: "Melhor dia",
    commits: "Commits",
    prs: "Pull Requests",
    reviews: "Revisões",
    stars: "Estrelas",
    followers: "Seguidores",
    activityTitle: "Atividade de contribuições",
    activitySub: (n) => `${n} contribuições no último ano`,
    activityAlt: `Atividade de contribuições de ${USER}`,
    cellTip: (n, date) => `${n} contribuições em ${date}`,
    weekly: "Semanal",
    peak: (n) => `Semana de pico: ${n} contribuições`,
    mostDay: "Dia mais ativo",
    mostMonth: "Mês mais ativo",
    less: "Menos",
    more: "Mais",
    langsTitle: "Linguagens mais usadas",
    langsSub: "por tamanho de código, repositórios próprios, sem marcação e código gerado",
    langsAlt: `Linguagens mais usadas de ${USER}`,
    other: "Outras",
  },
};
let L = LOCALES.en; // locale being rendered; set per iteration at the bottom

const dayMs = 86400000;
const fmt = (n) => n.toLocaleString(L.locale);
const toDay = (s) => Date.parse(`${s}T00:00:00Z`);
const fmtDate = (ms) =>
  new Date(ms).toLocaleDateString(L.locale, { month: "short", day: "numeric", timeZone: "UTC" });
const fmtFull = (ms) =>
  new Date(ms).toLocaleDateString(L.locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function collectRepos() {
  const repos = [];
  let after = null;
  do {
    const d = await gql(
      `query($u:String!,$after:String){ user(login:$u){
        repositories(ownerAffiliations:OWNER, isFork:false, first:100, after:$after){
          pageInfo{ hasNextPage endCursor }
          nodes{ stargazerCount
            languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } } } } }`,
      { u: USER, after },
    );
    const page = d.user.repositories;
    repos.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return repos;
}

async function collect() {
  const base = await gql(
    `query($u:String!){ user(login:$u){ createdAt followers{ totalCount }
      pullRequests{ totalCount } issues{ totalCount }
      repositoriesContributedTo(first:1, contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]){ totalCount } } }`,
    { u: USER },
  );
  const user = base.user;
  const startYear = new Date(user.createdAt).getUTCFullYear();
  const nowYear = new Date().getUTCFullYear();

  const days = [];
  let commits = 0;
  let reviews = 0;
  for (let y = startYear; y <= nowYear; y++) {
    const d = await gql(
      `query($u:String!,$f:DateTime!,$t:DateTime!){ user(login:$u){ contributionsCollection(from:$f,to:$t){
        totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions
        contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`,
      { u: USER, f: `${y}-01-01T00:00:00Z`, t: `${y}-12-31T23:59:59Z` },
    );
    const c = d.user.contributionsCollection;
    commits += c.totalCommitContributions + c.restrictedContributionsCount;
    reviews += c.totalPullRequestReviewContributions;
    for (const w of c.contributionCalendar.weeks)
      for (const day of w.contributionDays) days.push([toDay(day.date), day.contributionCount]);
  }
  days.sort((a, b) => a[0] - b[0]);
  const seen = new Set();
  const uniq = days.filter(([t]) => (seen.has(t) ? false : seen.add(t)));

  const repos = await collectRepos();
  const langs = new Map();
  for (const r of repos)
    for (const e of r.languages.edges) {
      if (EXCLUDED_LANGS.has(e.node.name)) continue;
      const cur = langs.get(e.node.name) ?? { size: 0, color: e.node.color ?? "#8b8fa3" };
      cur.size += e.size;
      langs.set(e.node.name, cur);
    }

  return {
    days: uniq,
    commits,
    reviews,
    followers: user.followers.totalCount,
    prs: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    langs: [...langs].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.size - a.size),
  };
}

function streaks(days) {
  const today = Date.now() - (Date.now() % dayMs);
  const total = days.reduce((s, [, n]) => s + n, 0);
  const first = days.find(([, n]) => n > 0)?.[0] ?? today;

  let best = { len: 0, start: 0, end: 0 };
  let cur = { len: 0, start: 0, end: 0 };
  for (const [t, n] of days) {
    if (n > 0) {
      if (cur.len > 0 && t - cur.end === dayMs) { cur.len++; cur.end = t; }
      else cur = { len: 1, start: t, end: t };
      if (cur.len > best.len) best = { ...cur };
    } else if (t < today) {
      cur = { len: 0, start: 0, end: 0 };
    }
  }
  // streak stays alive if today has no contributions yet but yesterday did
  if (!(cur.len > 0 && today - cur.end <= dayMs)) cur = { len: 0, start: 0, end: 0 };

  const lastYear = days.filter(([t]) => t > today - 365 * dayMs);
  const lastYearTotal = lastYear.reduce((s, [, n]) => s + n, 0);
  const activeDays = lastYear.filter(([, n]) => n > 0).length;
  const bestDay = days.reduce((b, d) => (d[1] > b[1] ? d : b), [0, 0]);
  return { total, first, today, cur, best, lastYearTotal, activeDays, bestDay };
}

const svg = (h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" lang="${L.locale}" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:${FONT}}
.in{opacity:0;animation:f .6s ease forwards}
@keyframes f{to{opacity:1}}
@keyframes r{from{stroke-dashoffset:264}to{stroke-dashoffset:0}}
.ring{stroke-dasharray:264;animation:r 1.2s ease forwards}
@keyframes g{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.grow{transform-origin:0 0;animation:g 1s ease forwards}
@media (prefers-reduced-motion:reduce){.in,.ring,.grow{animation:none;opacity:1}}</style>
<rect width="${W}" height="${h}" rx="4.5" fill="${theme.bg}"/>${body}</svg>`;

const sectionTitle = (text, sub = "") =>
  `<text x="28" y="36" font-size="18" font-weight="600" fill="${theme.title}">${esc(text)}</text>` +
  (sub ? `<text x="${W - 28}" y="36" text-anchor="end" font-size="12" fill="${theme.label}">${esc(sub)}</text>` : "");

function statsCard(s, d) {
  const H = 250;
  const range = (r) => (r.len ? `${fmtDate(r.start)} - ${fmtFull(r.end)}` : "No active streak");
  const col = (x, big, label, sub, ring, delay) => `
<g class="in" style="animation-delay:${delay}ms">
${ring ? `<circle cx="${x}" cy="72" r="42" fill="none" stroke="${theme.accent}" stroke-opacity=".2" stroke-width="5"/>
<circle class="ring" cx="${x}" cy="72" r="42" fill="none" stroke="${theme.accent}" stroke-width="5" stroke-linecap="round" transform="rotate(-90 ${x} 72)"/>` : ""}
<text x="${x}" y="82" text-anchor="middle" font-size="30" font-weight="700" fill="${theme.text}">${big}</text>
<text x="${x}" y="138" text-anchor="middle" font-size="15" font-weight="600" fill="${ring ? theme.icon : theme.title}">${label}</text>
<text x="${x}" y="156" text-anchor="middle" font-size="11" fill="${theme.label}">${sub}</text>
</g>`;

  const stats = [
    [L.lastYear, fmt(s.lastYearTotal)],
    [L.activeDays, fmt(s.activeDays)],
    [L.bestDay, fmt(s.bestDay[1])],
    [L.commits, fmt(d.commits)],
    [L.prs, fmt(d.prs)],
    [L.reviews, fmt(d.reviews)],
    [L.stars, fmt(d.stars)],
    [L.followers, fmt(d.followers)],
  ];
  const step = (W - 56) / stats.length;
  const statCol = ([k, v], i) => `
<g class="in" style="animation-delay:${600 + i * 100}ms">
<text x="${28 + step * i + step / 2}" y="206" text-anchor="middle" font-size="18" font-weight="700" fill="${theme.text}">${v}</text>
<text x="${28 + step * i + step / 2}" y="225" text-anchor="middle" font-size="11" fill="${theme.label}">${k}</text>
</g>`;

  const body =
    col(W / 6, fmt(s.total), L.total, `${fmtFull(s.first)} - ${L.present}`, false, 0) +
    col(W / 2, s.cur.len, L.currentStreak, range(s.cur), true, 200) +
    col((W * 5) / 6, s.best.len, L.longestStreak, range(s.best), false, 400) +
    `<line x1="${W / 3}" y1="28" x2="${W / 3}" y2="156" stroke="${theme.label}" stroke-opacity=".25"/>
<line x1="${(W * 2) / 3}" y1="28" x2="${(W * 2) / 3}" y2="156" stroke="${theme.label}" stroke-opacity=".25"/>
<line x1="28" y1="178" x2="${W - 28}" y2="178" stroke="${theme.label}" stroke-opacity=".25"/>` +
    stats.map(statCol).join("");
  return svg(H, body, L.statsAlt);
}

function heatmapCard(s, days) {
  const cell = 11;
  const gap = 3;
  const pitch = cell + gap;
  const x0 = 62;
  const y0 = 94;
  const H = 344;

  const map = new Map(days);
  const today = s.today;
  const todayDow = new Date(today).getUTCDay();
  const start = today - todayDow * dayMs - 52 * 7 * dayMs; // Sunday, 52 weeks back

  const values = [];
  for (let t = start; t <= today; t += dayMs) values.push(map.get(t) ?? 0);
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => nonZero[Math.min(nonZero.length - 1, Math.floor(nonZero.length * p))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);

  let cells = "";
  let months = "";
  let lastMonth = -1;
  for (let w = 0; w < 53; w++) {
    let col = "";
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * dayMs;
      if (t > today) break;
      const v = map.get(t) ?? 0;
      col += `<rect x="${x0 + w * pitch}" y="${y0 + d * pitch}" width="${cell}" height="${cell}" rx="2" fill="${theme.heat[level(v)]}"><title>${L.cellTip(fmt(v), fmtFull(t))}</title></rect>`;
    }
    cells += `<g class="in" style="animation-delay:${Math.round(w * 15)}ms">${col}</g>`;
    const month = new Date(start + w * 7 * dayMs).getUTCMonth();
    if (month !== lastMonth && w < 51 && (w === 0 ? new Date(start + 2 * 7 * dayMs).getUTCMonth() === month : true)) {
      months += `<text x="${x0 + w * pitch}" y="${y0 - 14}" font-size="11" fill="${theme.label}">${new Date(start + w * 7 * dayMs).toLocaleDateString(L.locale, { month: "short", timeZone: "UTC" })}</text>`;
      lastMonth = month;
    } else if (month !== lastMonth) lastMonth = month;
  }

  const dows = [1, 3, 5]
    .map((i) => [new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(L.locale, { weekday: "short", timeZone: "UTC" }), i])
    .map(([n, i]) => `<text x="${x0 - 10}" y="${y0 + i * pitch + 9}" text-anchor="end" font-size="10" fill="${theme.label}">${n}</text>`)
    .join("");

  const byDow = Array(7).fill(0);
  const byMonth = Array(12).fill(0);
  for (let t = start; t <= today; t += dayMs) {
    const v = map.get(t) ?? 0;
    byDow[new Date(t).getUTCDay()] += v;
    byMonth[new Date(t).getUTCMonth()] += v;
  }
  const top = (a) => a.indexOf(Math.max(...a));
  const dowName = new Date(Date.UTC(2024, 0, 7 + top(byDow))).toLocaleDateString(L.locale, { weekday: "long", timeZone: "UTC" });
  const monthName = new Date(Date.UTC(2024, top(byMonth), 1)).toLocaleDateString(L.locale, { month: "long", timeZone: "UTC" });
  const summary = `<text x="28" y="${H - 20}" font-size="11" fill="${theme.label}">${L.mostDay}: ${dowName} · ${L.mostMonth}: ${monthName}</text>`;

  const weekly = Array.from({ length: 53 }, (_, w) => {
    let sum = 0;
    for (let d = 0; d < 7; d++) sum += map.get(start + (w * 7 + d) * dayMs) ?? 0;
    return sum;
  });
  const peak = Math.max(...weekly, 1);
  const sTop = 240;
  const sBase = 280;
  const pts = weekly.map((v, w) => [x0 + w * pitch + cell / 2, sBase - (v / peak) * (sBase - sTop)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const peakIdx = weekly.indexOf(peak);
  const spark = `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.accent}" stop-opacity=".45"/><stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/></linearGradient></defs>
<g class="in" style="animation-delay:700ms">
<text x="${x0 - 10}" y="${sBase}" text-anchor="end" font-size="10" fill="${theme.label}">${L.weekly}</text>
<path d="${line} L${pts.at(-1)[0].toFixed(1)} ${sBase} L${pts[0][0].toFixed(1)} ${sBase} Z" fill="url(#sg)"/>
<path d="${line}" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="${pts[peakIdx][0].toFixed(1)}" cy="${pts[peakIdx][1].toFixed(1)}" r="3.5" fill="${theme.heat[4]}"/>
<text x="${(pts[peakIdx][0] + 4).toFixed(1)}" y="${sTop - 18}" text-anchor="end" font-size="11" fill="${theme.heat[4]}">${L.peak(fmt(peak))}</text>
</g>`;

  const lx = W - 28 - 5 * pitch - 70;
  const legend =
    `<text x="${lx}" y="${H - 20}" text-anchor="end" font-size="11" fill="${theme.label}">${L.less}</text>` +
    theme.heat.map((c, i) => `<rect x="${lx + 8 + i * pitch}" y="${H - 30}" width="${cell}" height="${cell}" rx="2" fill="${c}"/>`).join("") +
    `<text x="${lx + 8 + 5 * pitch + 4}" y="${H - 20}" font-size="11" fill="${theme.label}">${L.more}</text>`;

  const body =
    sectionTitle(L.activityTitle, L.activitySub(fmt(s.lastYearTotal))) +
    months + dows + cells + spark +
    `<line x1="28" y1="${H - 46}" x2="${W - 28}" y2="${H - 46}" stroke="${theme.label}" stroke-opacity=".25"/>` +
    summary + legend;
  return svg(H, body, L.activityAlt);
}

function languagesCard(langs) {
  const sum = langs.reduce((t, l) => t + l.size, 0);
  const top = langs.slice(0, 8).filter((l) => l.size / sum >= 0.01);
  const other = sum - top.reduce((t, l) => t + l.size, 0);
  const items = other > 0 ? [...top, { name: L.other, color: "#565f89", size: other }] : top;
  const total = items.reduce((s, l) => s + l.size, 0);

  const barX = 28;
  const barW = W - 56;
  const barY = 58;
  let x = barX;
  let segs = "";
  items.forEach((l) => {
    const w = (l.size / total) * barW;
    segs += `<rect x="${x.toFixed(2)}" y="${barY}" width="${Math.max(w - 1, 0.5).toFixed(2)}" height="12" fill="${l.color}"><title>${esc(l.name)}</title></rect>`;
    x += w;
  });

  const cols = 3;
  const colW = barW / cols;
  const legend = items
    .map((l, i) => {
      const cx = barX + (i % cols) * colW;
      const cy = 104 + Math.floor(i / cols) * 28;
      const pct = ((l.size / total) * 100).toFixed(1);
      return `<g class="in" style="animation-delay:${300 + i * 80}ms">
<circle cx="${cx + 5}" cy="${cy - 4}" r="5" fill="${l.color}"/>
<text x="${cx + 18}" y="${cy}" font-size="13" font-weight="600" fill="${theme.text}">${esc(l.name)}</text>
<text x="${cx + colW - 24}" y="${cy}" text-anchor="end" font-size="13" fill="${theme.label}">${pct}%</text></g>`;
    })
    .join("");

  const rows = Math.ceil(items.length / cols);
  const H = 104 + rows * 28 + 4;
  const body =
    sectionTitle(L.langsTitle, L.langsSub) +
    `<clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="12" rx="6"/></clipPath>
<g clip-path="url(#bar)"><g class="grow">${segs}</g></g>` +
    legend;
  return svg(H, body, L.langsAlt);
}

// Decorative waving banner: three sine layers drifting at different speeds, seamless because each
// layer is translated by exactly one wave period.
function banner(flip) {
  const BW = 1200;
  const BH = 120;
  // Drawn back to front: the lowest edge first, so every layer stays visible under the next.
  const layers = [
    { base: 100, amp: 9, period: 600, phase: 0, fill: "#1e3a6e", opacity: 0.7, secs: 24, dir: 1 },
    { base: 84, amp: 9, period: 400, phase: 1.6, fill: "#2d5bb5", opacity: 0.75, secs: 18, dir: -1 },
    { base: 66, amp: 8, period: 300, phase: 3.1, fill: "url(#wg)", opacity: 1, secs: 13, dir: 1 },
  ];
  const path = (l) => {
    // Extends to both sides of the viewBox so a layer drifting either way never exposes an empty edge.
    const from = -BW;
    const to = BW * 2;
    let d = `M${from} ${l.base}`;
    for (let x = from; x <= to; x += 20)
      d += ` L${x} ${(l.base + l.amp * Math.sin((2 * Math.PI * x) / l.period + l.phase)).toFixed(1)}`;
    return `${d} L${to} 0 L${from} 0 Z`;
  };
  const css = layers
    .map((l, i) => `.w${i}{animation:m${i} ${l.secs}s linear infinite}@keyframes m${i}{to{transform:translateX(${-l.dir * l.period}px)}}`)
    .join("");
  const paths = layers
    .map((l, i) => `<path class="w${i}" d="${path(l)}" fill="${l.fill}" fill-opacity="${l.opacity}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BW}" height="${BH}" viewBox="0 0 ${BW} ${BH}" role="img" aria-label="">
<defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#2d5bb5"/><stop offset=".5" stop-color="#4f8ef0"/><stop offset="1" stop-color="#9ec5ff"/></linearGradient></defs>
<style>${css}@media (prefers-reduced-motion:reduce){path{animation:none}}</style>
<g${flip ? ` transform="translate(0 ${BH}) scale(1 -1)"` : ""}>${paths}</g></svg>`;
}

const data = await collect();
const s = streaks(data.days);
for (const [code, locale] of Object.entries(LOCALES)) {
  L = locale;
  const dir = `${OUT}/${code}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/profile-stats.svg`, statsCard(s, data));
  writeFileSync(`${dir}/contributions.svg`, heatmapCard(s, data.days));
  writeFileSync(`${dir}/languages.svg`, languagesCard(data.langs));
}
writeFileSync(`${OUT}/banner-header.svg`, banner(false));
writeFileSync(`${OUT}/banner-footer.svg`, banner(true));
console.log("generated", Object.keys(LOCALES).join(", "), "->", OUT);
