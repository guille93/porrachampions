/* Porra Champions 25-26 – app sin dependencias, preparada para GitHub Pages */
const STORAGE_KEY = "porra_champions_25_26_state_v2";

/**
 * data.json: datos base extraídos del Excel (League, ADMIN, CLAS)
 * state.json (opcional): overrides compartidos en el repo (resultados reales y picks “actuales”)
 * localStorage: overrides privados del navegador (se aplican por encima)
 */
let DATA = null;

let STATE = {
  overrides: {
    matchesActual: {},   // matchId -> {home, away} | null
    picksActual: {
      positions: {},         // position -> team | null
      octavosFromLeague: {}, // slot -> team | null
      playoffsTeams: {}      // slot -> team | null
    }
  }
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function safeInt(v){
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

function signFromScores(h, a){
  if (h > a) return "1";
  if (h < a) return "2";
  return "X";
}

function stageKeyForScoring(stage){
  switch(stage){
    case "league": return "FASE DE LIGA";
    case "playoffs": return "PLAYOFFS";
    case "round_of_16": return "OCTAVOS";
    case "quarterfinals": return "CUARTOS";
    case "semifinals": return "SEMIFINALES";
    case "final": return "FINAL";
    default: return "FASE DE LIGA";
  }
}

function displayStage(stage){
  switch(stage){
    case "league": return "Fase de liga";
    case "playoffs": return "Playoffs";
    case "round_of_16": return "Octavos";
    case "quarterfinals": return "Cuartos";
    case "semifinals": return "Semifinales";
    case "final": return "Final";
    default: return stage;
  }
}

function formatDate(iso){
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { dateStyle:"short", timeStyle:"short" }).format(d);
}

function deepMerge(target, source){
  if (!source || typeof source !== "object") return target;
  for (const [k,v] of Object.entries(source)){
    if (v && typeof v === "object" && !Array.isArray(v)){
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function loadLocalOverrides(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object"){
      deepMerge(STATE.overrides, parsed);
    }
  } catch(e){
    console.warn("No se pudo leer localStorage:", e);
  }
}

function saveLocalOverrides(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.overrides));
}

function resetLocalOverrides(){
  localStorage.removeItem(STORAGE_KEY);
  STATE.overrides = {
    matchesActual: {},
    picksActual: { positions:{}, octavosFromLeague:{}, playoffsTeams:{} }
  };
}

function getMatchActual(match){
  if (Object.prototype.hasOwnProperty.call(STATE.overrides.matchesActual, match.id)){
    return STATE.overrides.matchesActual[match.id];
  }
  return match.actual;
}

function setMatchActual(matchId, actual){
  STATE.overrides.matchesActual[matchId] = actual;
  saveLocalOverrides();
}

function getPickActual(group, key){
  const o = STATE.overrides.picksActual[group] || {};
  if (Object.prototype.hasOwnProperty.call(o, key)) return o[key];
  return null;
}

function computeMatchPoints(match, participantId){
  const actual = getMatchActual(match);
  const pred = match.predictions[String(participantId)] || null;
  if (!actual || !pred) return 0;

  const h1 = actual.home, a1 = actual.away;
  const h2 = pred.home, a2 = pred.away;

  const s1 = signFromScores(h1, a1);
  const s2 = signFromScores(h2, a2);

  const sk = stageKeyForScoring(match.stage);
  const cfg = DATA.rules.matchScoring[sk] || DATA.rules.matchScoring["FASE DE LIGA"];

  let pts = 0;
  if (s1 === s2) pts += Number(cfg.signPoints || 0);

  const exact = (h1 === h2 && a1 === a2);
  if (exact) pts += Number(cfg.exactBonusPoints || 0);

  const diffPoints = Number(cfg.diffPoints || 0);
  if (!exact && diffPoints){
    if ((h1 - a1) === (h2 - a2)) pts += diffPoints;
  }
  return pts;
}

function computeLeagueTable(){
  const teams = new Map();
  const ensure = (name) => {
    if (!teams.has(name)){
      teams.set(name, { team:name, Pts:0, J:0, G:0, E:0, P:0, GF:0, GC:0, DG:0 });
    }
    return teams.get(name);
  };

  for (const m of DATA.matches){
    if (m.stage !== "league") continue;
    const actual = getMatchActual(m);
    if (!actual) continue;

    const h = ensure(m.home);
    const a = ensure(m.away);

    h.J++; a.J++;
    h.GF += actual.home; h.GC += actual.away;
    a.GF += actual.away; a.GC += actual.home;

    if (actual.home > actual.away){
      h.G++; a.P++;
      h.Pts += 3;
    } else if (actual.home < actual.away){
      a.G++; h.P++;
      a.Pts += 3;
    } else {
      h.E++; a.E++;
      h.Pts += 1; a.Pts += 1;
    }
  }

  for (const s of teams.values()){
    s.DG = s.GF - s.GC;
  }

  const arr = Array.from(teams.values());
  // Replica el orden observado en el Excel: Pts desc, DG desc, GF desc, nombre asc
  arr.sort((x,y)=>{
    if (y.Pts !== x.Pts) return y.Pts - x.Pts;
    if (y.DG !== x.DG) return y.DG - x.DG;
    if (y.GF !== x.GF) return y.GF - x.GF;
    return String(x.team).localeCompare(String(y.team), "es");
  });
  arr.forEach((s,idx)=> s.pos = idx+1);
  return arr;
}

function computePickPointsForPlayer(playerId){
  const pp = Number(DATA.rules.pickScoring.positionExactPoints || 0);
  const po = Number(DATA.rules.pickScoring.octavosFromLeagueTeamPoints || 0);
  const ppo = Number(DATA.rules.pickScoring.playoffsTeamPoints || 0);

  let posPts = 0;
  for (const row of DATA.picks.positions){
    const actual = getPickActual("positions", String(row.position));
    if (!actual) continue;
    const pick = row.picks[String(playerId)];
    if (pick && pick === actual) posPts += pp;
  }

  let octPts = 0;
  for (const row of DATA.picks.octavosFromLeague){
    const actual = getPickActual("octavosFromLeague", row.slot);
    if (!actual) continue;
    const pick = row.picks[String(playerId)];
    if (pick && pick === actual) octPts += po;
  }

  let poPts = 0;
  for (const row of DATA.picks.playoffsTeams){
    const actual = getPickActual("playoffsTeams", row.slot);
    if (!actual) continue;
    const pick = row.picks[String(playerId)];
    if (pick && pick === actual) poPts += ppo;
  }

  return { posPts, octPts, poPts, total: posPts + octPts + poPts };
}

function computeLeaderboard(){
  const lb = [];
  for (const p of DATA.participants){
    let matchPts = 0;
    for (const m of DATA.matches){
      matchPts += computeMatchPoints(m, p.id);
    }
    const pick = computePickPointsForPlayer(p.id);
    const total = matchPts + pick.total;
    lb.push({ id: p.id, name: p.name, total, matchPts, pick });
  }
  lb.sort((a,b)=>{
    if (b.total !== a.total) return b.total - a.total;
    return String(a.name).localeCompare(String(b.name), "es");
  });
  lb.forEach((x, idx) => x.rank = idx+1);
  return lb;
}

function populateSelectOptions(){
  const stages = [
    { key:"all", label:"Todas" },
    { key:"league", label:"Fase de liga" },
    { key:"playoffs", label:"Playoffs" },
    { key:"round_of_16", label:"Octavos" },
    { key:"quarterfinals", label:"Cuartos" },
    { key:"semifinals", label:"Semifinales" },
    { key:"final", label:"Final" },
  ];
  const sel1 = $("#leagueStageFilter");
  const sel2 = $("#adminStageFilter");
  sel1.innerHTML = "";
  sel2.innerHTML = "";
  for (const s of stages){
    const o1 = document.createElement("option");
    o1.value = s.key; o1.textContent = s.label;
    sel1.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = s.key; o2.textContent = s.label;
    sel2.appendChild(o2);
  }
  sel1.value = "all";
  sel2.value = "all";

  const pSel = $("#adminPlayerFilter");
  pSel.innerHTML = "";
  const oAll = document.createElement("option");
  oAll.value = "all";
  oAll.textContent = "Todos (resumen)";
  pSel.appendChild(oAll);

  for (const p of DATA.participants){
    const o = document.createElement("option");
    o.value = String(p.id);
    o.textContent = p.name;
    pSel.appendChild(o);
  }
  pSel.value = String(DATA.participants[0]?.id || "all");

  $("#posPoints").textContent = String(DATA.rules.pickScoring.positionExactPoints ?? 0);
  $("#octPoints").textContent = String(DATA.rules.pickScoring.octavosFromLeagueTeamPoints ?? 0);
  $("#poTeamPoints").textContent = String(DATA.rules.pickScoring.playoffsTeamPoints ?? 0);
}

function renderMatchesTable(){
  const stageFilter = $("#leagueStageFilter").value;
  const playedFilter = $("#leaguePlayedFilter").value;
  const q = $("#leagueSearch").value.trim().toLowerCase();

  const tbody = $("#matchesTable tbody");
  tbody.innerHTML = "";

  const rows = DATA.matches.filter(m => {
    if (stageFilter !== "all" && m.stage !== stageFilter) return false;
    const actual = getMatchActual(m);
    if (playedFilter === "played" && !actual) return false;
    if (playedFilter === "upcoming" && actual) return false;
    if (q){
      const hay = `${m.home} ${m.away} ${displayStage(m.stage)} ${String(m.matchday ?? "")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  for (const m of rows){
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDate(m.datetime);
    tr.appendChild(tdDate);

    const tdStage = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = displayStage(m.stage);
    tdStage.appendChild(pill);
    tr.appendChild(tdStage);

    const tdFix = document.createElement("td");
    tdFix.textContent = `${m.home} – ${m.away}`;
    tr.appendChild(tdFix);

    const tdRes = document.createElement("td");
    tdRes.className = "center";
    const actual = getMatchActual(m);
    tdRes.textContent = actual ? `${actual.home}-${actual.away} (${signFromScores(actual.home, actual.away)})` : "—";
    tr.appendChild(tdRes);

    const tdAct = document.createElement("td");
    tdAct.className = "right";
    const a = document.createElement("a");
    a.href = "#";
    a.className = "edit-link";
    a.textContent = "Editar";
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      openEditDialog(m);
    });
    tdAct.appendChild(a);
    tr.appendChild(tdAct);

    tbody.appendChild(tr);
  }
}

function renderStandings(){
  const tbody = $("#standingsTable tbody");
  tbody.innerHTML = "";
  const table = computeLeagueTable();
  for (const s of table){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="center">${s.pos}</td>
      <td>${s.team}</td>
      <td class="center">${s.Pts}</td>
      <td class="center">${s.J}</td>
      <td class="center">${s.G}</td>
      <td class="center">${s.E}</td>
      <td class="center">${s.P}</td>
      <td class="center">${s.GF}</td>
      <td class="center">${s.GC}</td>
      <td class="center">${s.DG}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderClas(){
  const sort = $("#clasSort").value;
  const tbody = $("#clasTable tbody");
  tbody.innerHTML = "";

  let lb = computeLeaderboard();
  if (sort === "name"){
    lb = lb.slice().sort((a,b)=> String(a.name).localeCompare(String(b.name), "es"));
    lb.forEach((x, idx) => x.rank = idx+1);
  }

  for (const row of lb){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="center">${row.rank}</td>
      <td>${row.name}</td>
      <td class="center">${row.total}</td>
      <td class="center muted small">Partidos: ${row.matchPts} · Picks: ${row.pick.total}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAdmin(){
  const stageFilter = $("#adminStageFilter").value;
  const playerFilter = $("#adminPlayerFilter").value;
  const q = $("#adminSearch").value.trim().toLowerCase();

  const tbody = $("#adminMatchesTable tbody");
  tbody.innerHTML = "";

  const rows = DATA.matches.filter(m => {
    if (stageFilter !== "all" && m.stage !== stageFilter) return false;
    if (q){
      const hay = `${m.home} ${m.away} ${displayStage(m.stage)} ${String(m.matchday ?? "")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (playerFilter === "all"){
    for (const m of rows){
      const actual = getMatchActual(m);
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = formatDate(m.datetime);
      tr.appendChild(tdDate);

      const tdStage = document.createElement("td");
      tdStage.textContent = displayStage(m.stage);
      tr.appendChild(tdStage);

      const tdFix = document.createElement("td");
      tdFix.textContent = `${m.home} – ${m.away}`;
      tr.appendChild(tdFix);

      const tdReal = document.createElement("td");
      tdReal.className = "center";
      tdReal.textContent = actual ? `${actual.home}-${actual.away}` : "—";
      tr.appendChild(tdReal);

      const tdPred = document.createElement("td");
      tdPred.className = "center muted small";
      if (!actual){
        tdPred.textContent = "Pendiente";
      } else {
        let maxPts = -1;
        let winners = [];
        let exactCount = 0;
        for (const p of DATA.participants){
          const pts = computeMatchPoints(m, p.id);
          if (pts > maxPts){
            maxPts = pts; winners = [p.name];
          } else if (pts === maxPts){
            winners.push(p.name);
          }
          const pred = m.predictions[String(p.id)];
          if (pred && pred.home === actual.home && pred.away === actual.away) exactCount++;
        }
        tdPred.textContent = `Máx: ${maxPts} (${winners.join(", ")}) · Exactos: ${exactCount}`;
      }
      tr.appendChild(tdPred);

      const tdPts = document.createElement("td");
      tdPts.className = "center";
      tdPts.textContent = "";
      tr.appendChild(tdPts);

      tbody.appendChild(tr);
    }
  } else {
    const pid = Number(playerFilter);
    for (const m of rows){
      const actual = getMatchActual(m);
      const pred = m.predictions[String(pid)] || null;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(m.datetime)}</td>
        <td>${displayStage(m.stage)}</td>
        <td>${m.home} – ${m.away}</td>
        <td class="center">${actual ? `${actual.home}-${actual.away}` : "—"}</td>
        <td class="center">${pred ? `${pred.home}-${pred.away}` : "—"}</td>
        <td class="center">${computeMatchPoints(m, pid)}</td>
      `;
      tbody.appendChild(tr);
    }

    renderPickTablesForPlayer(pid);
  }
}

function renderPickTablesForPlayer(pid){
  const pp = Number(DATA.rules.pickScoring.positionExactPoints || 0);
  const po = Number(DATA.rules.pickScoring.octavosFromLeagueTeamPoints || 0);
  const ppo = Number(DATA.rules.pickScoring.playoffsTeamPoints || 0);

  const posBody = $("#positionsTable tbody");
  posBody.innerHTML = "";
  for (const row of DATA.picks.positions){
    const pick = row.picks[String(pid)] || "—";
    const actual = getPickActual("positions", String(row.position));
    const pts = (actual && pick === actual) ? pp : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="center">${row.position}</td><td>${pick || "—"}</td><td class="center">${pts}</td>`;
    posBody.appendChild(tr);
  }

  const octBody = $("#octavosTable tbody");
  octBody.innerHTML = "";
  for (const row of DATA.picks.octavosFromLeague){
    const pick = row.picks[String(pid)] || "—";
    const actual = getPickActual("octavosFromLeague", row.slot);
    const pts = (actual && pick === actual) ? po : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.slot}</td><td>${pick || "—"}</td><td class="center">${pts}</td>`;
    octBody.appendChild(tr);
  }

  const poBody = $("#playoffsTeamsTable tbody");
  poBody.innerHTML = "";
  for (const row of DATA.picks.playoffsTeams){
    const pick = row.picks[String(pid)] || "—";
    const actual = getPickActual("playoffsTeams", row.slot);
    const pts = (actual && pick === actual) ? ppo : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.slot}</td><td>${pick || "—"}</td><td class="center">${pts}</td>`;
    poBody.appendChild(tr);
  }
}

function wireTabs(){
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-selected","true");

      const view = btn.dataset.view;
      $$(".view").forEach(v=>v.classList.remove("active"));
      $(`#view-${view}`).classList.add("active");

      rerenderAll();
    });
  });
}

let DLG_MATCH = null;
let DLG_MATCH_ID = null;

function openEditDialog(match){
  DLG_MATCH_ID = match.id;
  const dlg = $("#dlgMatch");
  DLG_MATCH = dlg;

  const actual = getMatchActual(match);
  $("#dlgTitle").textContent = `Editar resultado: ${match.home} – ${match.away}`;
  $("#dlgHint").textContent = `Fase: ${displayStage(match.stage)} · Fecha: ${formatDate(match.datetime)} · Se recalcula todo automáticamente.`;

  $("#dlgHome").value = actual ? String(actual.home) : "";
  $("#dlgAway").value = actual ? String(actual.away) : "";

  dlg.showModal();
}

function closeDialog(){
  if (DLG_MATCH) DLG_MATCH.close();
  DLG_MATCH_ID = null;
}

function wireDialog(){
  $("#dlgSave").addEventListener("click", (ev) => {
    const h = safeInt($("#dlgHome").value);
    const a = safeInt($("#dlgAway").value);

    if ((h === null && a !== null) || (h !== null && a === null)){
      ev.preventDefault();
      $("#dlgHint").textContent = "Para guardar, introduce ambos goles (o deja ambos vacíos para borrar el resultado).";
      $("#dlgHint").style.color = "var(--danger)";
      return;
    }
    $("#dlgHint").style.color = "";

    if (h === null && a === null){
      setMatchActual(DLG_MATCH_ID, null);
    } else {
      setMatchActual(DLG_MATCH_ID, { home:h, away:a });
    }
    closeDialog();
    rerenderAll();
  });
}

function exportState(){
  const out = {
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    overrides: STATE.overrides
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "state.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importStateFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result || ""));
      const overrides = parsed.overrides || parsed;
      if (!overrides || typeof overrides !== "object") throw new Error("JSON inválido");
      // Reemplazamos overrides completos (para evitar merges raros)
      STATE.overrides = deepMerge({
        matchesActual: {},
        picksActual: { positions:{}, octavosFromLeague:{}, playoffsTeams:{} }
      }, overrides);
      saveLocalOverrides();
      rerenderAll();
    } catch(e){
      alert("No se pudo importar el estado. Asegúrate de seleccionar un JSON exportado por la app (state.json).");
    }
  };
  reader.readAsText(file);
}

function wireButtons(){
  $("#btnExport").addEventListener("click", exportState);

  $("#btnImport").addEventListener("click", () => {
    $("#fileImport").value = "";
    $("#fileImport").click();
  });

  $("#fileImport").addEventListener("change", (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) importStateFile(file);
  });

  $("#btnReset").addEventListener("click", () => {
    resetLocalOverrides();
    rerenderAll();
  });
}

function wireFilters(){
  $("#leagueStageFilter").addEventListener("change", renderMatchesTable);
  $("#leaguePlayedFilter").addEventListener("change", renderMatchesTable);
  $("#leagueSearch").addEventListener("input", renderMatchesTable);

  $("#adminPlayerFilter").addEventListener("change", renderAdmin);
  $("#adminStageFilter").addEventListener("change", renderAdmin);
  $("#adminSearch").addEventListener("input", renderAdmin);

  $("#clasSort").addEventListener("change", renderClas);
}

function rerenderAll(){
  renderMatchesTable();
  renderStandings();
  renderAdmin();
  renderClas();

  const meta = DATA.meta || {};
  const source = meta.sourceFile ? `Datos: ${meta.sourceFile}` : "Datos cargados";
  const generated = meta.generatedAt ? `Generado: ${new Date(meta.generatedAt).toLocaleString("es-ES")}` : "";
  const remote = (STATE._remoteLoaded) ? "state.json: sí" : "state.json: no";
  $("#metaLine").textContent = [source, generated, remote].filter(Boolean).join(" · ");
}

async function tryLoadRemoteState(){
  try{
    const res = await fetch("state.json", { cache:"no-store" });
    if (!res.ok) return;
    const parsed = await res.json();
    const overrides = parsed.overrides || parsed;
    if (overrides && typeof overrides === "object"){
      deepMerge(STATE.overrides, overrides);
      STATE._remoteLoaded = true;
    }
  } catch(_e){
    // state.json es opcional
  }
}

async function init(){
  const res = await fetch("data.json", { cache:"no-store" });
  DATA = await res.json();

  // 1) Overrides compartidos (repo)
  await tryLoadRemoteState();

  // 2) Overrides locales (navegador) – tienen prioridad
  loadLocalOverrides();

  populateSelectOptions();
  wireTabs();
  wireDialog();
  wireButtons();
  wireFilters();
  rerenderAll();
}

init().catch(err => {
  console.error(err);
  $("#metaLine").textContent = "Error cargando data.json. Revisa la consola del navegador.";
});
