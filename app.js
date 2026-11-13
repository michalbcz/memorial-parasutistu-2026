(function () {
  "use strict";

  const WAVE_ORDER = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
    "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
    "Quebec", "Romeo", "Siera", "Tango", "Uniform", "Victor", "Whisky",
    "X-Ray", "Yenkee", "Zulu",
  ];

  const ROUTE_KM = 70.0;

  let DATA = null;
  let SUMMARY = null;
  let WAVES = null;
  let TEAMS = null;
  let TEAM_BY_ID = null;
  let WAVE_BY_NAME = null;

  let selectedTeamId = 407; // Bleskový přesun
  let waveChart = null;
  let waveMode = "counts";
  let lastWavesMobile = null;
  let simTimer = null;
  let sortState = { key: "id", asc: true };

  function parseHHMM(s) {
    if (!s) return null;
    const parts = s.split(":");
    if (parts.length !== 2) return null;
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function fmtMin(m) {
    if (m === null || m === undefined) return "–";
    const total = Math.round(m);
    const h = Math.floor(total / 60);
    const mm = total % 60;
    return `${h}:${mm < 10 ? "0" : ""}${mm}`;
  }

  function formatPace(totalMin) {
    const secPerKm = (totalMin * 60) / ROUTE_KM;
    let mins = Math.floor(secPerKm / 60);
    let secs = Math.round(secPerKm % 60);
    if (secs === 60) {
      mins += 1;
      secs = 0;
    }
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function calcMedian(sortedNums) {
    if (!sortedNums.length) return null;
    const mid = Math.floor(sortedNums.length / 2);
    return sortedNums.length % 2
      ? sortedNums[mid]
      : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
  }

  function fmtNumCz(n, decimals = 2) {
    return n.toFixed(decimals).replace(".", ",");
  }

  function parseCSVText(text) {
    const clean = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (inQuotes) {
        if (ch === '"') {
          if (clean[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function buildDatasetFromCSV(csvText) {
    const rawRows = parseCSVText(csvText);
    if (rawRows.length < 2) throw new Error("Empty CSV");

    const teams = [];
    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length < 16 || !r[0]) continue;
      const id = Number(r[0]);
      const wave = r[1];
      const schedStart = r[2];
      const start = r[3];
      const name = r[4];
      const status = r[5];
      const arrival = r[6];
      const total = r[7];
      const totalMin = r[8] ? Number(r[8]) : null;
      const rankOverall = r[9] ? Number(r[9]) : null;
      const rankInWave = r[10] ? Number(r[10]) : null;
      const under18h = r[11] === "Ano" ? true : r[11] === "Ne" ? false : null;
      const speedKmh = r[12] ? Number(r[12]) : null;
      const paceMinKm = r[13] || null;
      const waveJumper = r[14] === "Ano";
      const anomaly = r[15] || null;

      const startMin = parseHHMM(start);
      const schedMin = parseHHMM(schedStart);
      const arrMin = parseHHMM(arrival);
      const arrAbs = arrMin !== null && startMin !== null
        ? (arrMin >= startMin ? arrMin : arrMin + 1440)
        : null;

      const isUnassigned = status === "u" || anomaly === "unassigned";

      teams.push({
        id,
        wave,
        wave_scheduled_start: schedStart,
        wave_scheduled_min: schedMin,
        start,
        start_min: startMin,
        name,
        is_unassigned: isUnassigned,
        status,
        arrival,
        arrival_abs_min: arrAbs,
        total,
        total_min: totalMin,
        speed_kmh: speedKmh,
        pace_min_km: paceMinKm,
        under_18h: under18h,
        wave_jumper: waveJumper,
        start_diff_min: startMin !== null && schedMin !== null && !isUnassigned ? startMin - schedMin : 0,
        anomaly,
        rank_overall: rankOverall,
        rank_in_wave: rankInWave,
        percentile: null,
      });
    }

    const timedFinishers = teams
      .filter((t) => t.status === "a" && t.total_min !== null)
      .sort((a, b) => a.total_min - b.total_min || a.id - b.id);

    timedFinishers.forEach((t, idx) => {
      t.percentile = +((100 * (timedFinishers.length - (idx + 1))) / (timedFinishers.length - 1)).toFixed(1);
    });

    const waves = WAVE_ORDER.map((wName) => {
      const wAll = teams.filter((t) => t.wave === wName && !t.is_unassigned);
      const wA = wAll.filter((t) => t.status === "a");
      const wTimed = wA.filter((t) => t.total_min !== null).sort((a, b) => a.total_min - b.total_min || a.id - b.id);
      const wX = wAll.filter((t) => t.status === "x");
      const wN = wAll.filter((t) => t.status === "n");
      const starters = wA.length + wX.length;
      const times = wTimed.map((t) => t.total_min);
      const avg = times.length ? +(times.reduce((s, v) => s + v, 0) / times.length).toFixed(1) : null;
      const med = calcMedian(times);
      const medSpeed = med ? +(ROUTE_KM / (med / 60)).toFixed(2) : null;

      return {
        wave: wName,
        scheduled_start: wAll[0]?.wave_scheduled_start || "",
        scheduled_min: wAll[0]?.wave_scheduled_min || 0,
        registered: wAll.length,
        started: starters,
        finished: wA.length,
        finished_timed: wTimed.length,
        under_18h: wTimed.filter((t) => t.under_18h).length,
        over_18h: wTimed.filter((t) => t.under_18h === false).length,
        dnf: wX.length,
        dns: wN.length,
        success_rate: starters ? +((100 * wA.length) / starters).toFixed(1) : 0,
        avg_min: avg,
        median_min: med,
        median_str: med ? fmtMin(med) : null,
        median_speed_kmh: medSpeed,
        best_min: times.length ? times[0] : null,
        best_team_id: wTimed[0]?.id || null,
        best_team_name: wTimed[0]?.name || null,
        jumpers: wAll.filter((t) => t.wave_jumper).length,
      };
    });

    const aTeams = teams.filter((t) => t.status === "a");
    const xTeams = teams.filter((t) => t.status === "x");
    const nTeams = teams.filter((t) => t.status === "n");
    const uTeams = teams.filter((t) => t.is_unassigned);
    const allTimes = timedFinishers.map((t) => t.total_min);
    const avgMin = +(allTimes.reduce((s, v) => s + v, 0) / allTimes.length).toFixed(1);
    const medMin = calcMedian(allTimes);

    const summary = {
      event_name: "Memoriál československých parašutistů 2026",
      theme: "Tři králové – Pocta pplk. Josefu Mašínovi",
      date: "7. 11. 2026",
      distance_km: ROUTE_KM,
      limit_hours: 18,
      password: "SKOŘICE",
      total_rows: teams.length,
      assigned_teams: teams.length - uTeams.length,
      unassigned_slots: uTeams.length,
      started: aTeams.length + xTeams.length,
      finished_total: aTeams.length,
      finished_timed: timedFinishers.length,
      finished_untimed: aTeams.length - timedFinishers.length,
      under_18h: timedFinishers.filter((t) => t.under_18h).length,
      over_18h: timedFinishers.filter((t) => t.under_18h === false).length,
      dnf: xTeams.length,
      dns_named: nTeams.length,
      dns_pdf_total: nTeams.length + uTeams.length + 1,
      success_rate_pct: +((100 * aTeams.length) / (aTeams.length + xTeams.length)).toFixed(1),
      success_rate_pdf_pct: 80,
      avg_min: avgMin,
      avg_str: fmtMin(avgMin),
      avg_speed_kmh: +(ROUTE_KM / (avgMin / 60)).toFixed(2),
      median_min: medMin,
      median_str: fmtMin(medMin),
      median_speed_kmh: +(ROUTE_KM / (medMin / 60)).toFixed(2),
      median_pace_str: formatPace(Math.round(medMin)),
      fastest_min: timedFinishers[0].total_min,
      fastest_str: timedFinishers[0].total,
      slowest_min: timedFinishers[timedFinishers.length - 1].total_min,
      slowest_str: timedFinishers[timedFinishers.length - 1].total,
      wave_jumpers_count: teams.filter((t) => t.wave_jumper).length,
      total_km_finishers: aTeams.length * 2 * 70,
    };

    return { summary, waves, teams };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtClockAbs(absMin) {
    if (absMin === null || absMin === undefined) return "–";
    const day = absMin >= 1440 ? "NE" : "SO";
    const mDay = ((absMin % 1440) + 1440) % 1440;
    const h = Math.floor(mDay / 60);
    const m = mDay % 60;
    return `${day} ${h}:${m < 10 ? "0" : ""}${m}`;
  }

  function statusBadge(t) {
    if (t.is_unassigned) return `<span class="badge badge-u">neobsazeno</span>`;
    if (t.status === "a") {
      if (t.total_min === null) return `<span class="badge badge-anom">a • bez času</span>`;
      if (t.under_18h) return `<span class="badge badge-a">a • v limitu</span>`;
      return `<span class="badge badge-over">a • nad 18h</span>`;
    }
    if (t.status === "x") {
      if (t.total_min !== null) return `<span class="badge badge-anom">x • čas ${t.total}</span>`;
      return `<span class="badge badge-x">x • DNF</span>`;
    }
    if (t.status === "n") return `<span class="badge badge-n">n • DNS</span>`;
    return "";
  }

  // 1. Patrol Password
  function initPatrol() {
    const input = document.getElementById("patrol-input");
    const btn = document.getElementById("patrol-btn");
    const banner = document.getElementById("secret-banner");
    const close = document.getElementById("secret-close");
    document.getElementById("secret-km").textContent =
      SUMMARY.total_km_finishers.toLocaleString("cs-CZ") + " km";

    function check() {
      const val = input.value.trim().toUpperCase();
      if (val === "SKOŘICE" || val === "SKORICE") {
        banner.classList.add("visible");
        input.style.borderColor = "var(--signal-green)";
      } else {
        input.style.borderColor = "var(--signal-red)";
        input.value = "";
        input.placeholder = "Zkus SKOŘICE";
      }
    }

    btn.addEventListener("click", check);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") check();
    });
    close.addEventListener("click", () => banner.classList.remove("visible"));
  }

  // 2. Telemetry Ledger in Hero
  function renderKPIs() {
    const grid = document.getElementById("kpi-grid");
    const cells = [
      {
        cls: "",
        label: "Odstartovalo hlídek",
        value: `${SUMMARY.started}`,
        sub: `Z ${SUMMARY.total_rows} čísel (${SUMMARY.dns_named} DNS + 4 neobs. + č. 410)`,
      },
      {
        cls: "accent-green",
        label: "Dokončilo (Stav a)",
        value: `${SUMMARY.finished_total} (${SUMMARY.success_rate_pdf_pct} %)`,
        sub: `Přesně ${fmtNumCz(SUMMARY.success_rate_pct, 1)} % • ${SUMMARY.finished_untimed} bez času`,
      },
      {
        cls: "accent-green",
        label: "V 18h limitu (≤ 18:00)",
        value: `${SUMMARY.under_18h}`,
        sub: `${fmtNumCz((SUMMARY.under_18h / SUMMARY.started) * 100, 1)} % ze startujících`,
      },
      {
        cls: "accent-amber",
        label: "Nad limit (> 18:00)",
        value: `${SUMMARY.over_18h}`,
        sub: "Nejtěsnější: #2 SPARTA II (18:01)",
      },
      {
        cls: "accent-sand",
        label: "Nedokončilo (DNF / x)",
        value: `${SUMMARY.dnf}`,
        sub: `${fmtNumCz((SUMMARY.dnf / SUMMARY.started) * 100, 1)} % ze startujících`,
      },
      {
        cls: "accent-green",
        label: "Medián rychlosti & času",
        value: `${fmtNumCz(SUMMARY.median_speed_kmh)} km/h`,
        sub: `Medián ${SUMMARY.median_str} (${SUMMARY.median_pace_str} /km) • Rekord ${SUMMARY.fastest_str}`,
      },
    ];

    grid.innerHTML = cells
      .map(
        (c) => `
      <div class="ledger-cell ${c.cls}">
        <div class="ledger-label">${c.label}</div>
        <div class="ledger-value">${c.value}</div>
        <div class="ledger-sub">${c.sub}</div>
      </div>`
      )
      .join("");
  }

  // 3. Team Dossier & Search
  function renderDossier(id) {
    const t = TEAM_BY_ID.get(id);
    if (!t) return;
    selectedTeamId = id;
    const w = WAVE_BY_NAME.get(t.wave);

    const container = document.getElementById("team-dossier");

    let speedDeltaStr = "–";
    if (t.speed_kmh !== null) {
      const diff = t.speed_kmh - SUMMARY.median_speed_kmh;
      const sign = diff >= 0 ? "+" : "−";
      speedDeltaStr = `${sign}${fmtNumCz(Math.abs(diff))} km/h vs. medián závodu`;
    }

    let markerPct = 50;
    if (t.total_min !== null) {
      markerPct = Math.max(
        1,
        Math.min(99, ((t.total_min - SUMMARY.fastest_min) / (SUMMARY.slowest_min - SUMMARY.fastest_min)) * 100)
      );
    }

    const flags = [];
    if (t.wave_jumper) {
      flags.push(
        `<span class="badge badge-anom">Mimo vlnu (${t.wave} plán ${t.wave_scheduled_start}, start ${t.start})</span>`
      );
    }
    if (t.anomaly === "dnf_with_time") {
      flags.push(`<span class="badge badge-anom">Anomálie: DNF (x) s časem v cíli</span>`);
    }
    if (t.anomaly === "finisher_no_time") {
      flags.push(`<span class="badge badge-anom">Anomálie: Dokončil (a) bez času</span>`);
    }

    const waveRankVal = t.rank_in_wave && w
      ? `${t.rank_in_wave}. / ${w.finished_timed}`
      : "–";
    const waveRankSub = w
      ? `ze ${w.started} odstartovaných (${w.registered} v ${t.wave})`
      : "";

    const overallRankVal = t.rank_overall
      ? `${t.rank_overall}. / ${SUMMARY.finished_timed}`
      : "–";
    const overallRankSub = `ze ${SUMMARY.started} odstartovaných • ${
      t.percentile !== null ? `Top ${fmtNumCz(100 - t.percentile, 1)} %` : "bez času"
    }`;

    const medianWaveStr = w && w.median_speed_kmh
      ? `Vlna ${t.wave}: ${fmtNumCz(w.median_speed_kmh)} km/h (${w.median_str})`
      : `Vlna ${t.wave}: bez času`;

    container.innerHTML = `
      <div class="dossier-sheet">
        <div class="dossier-head">
          <div>
            <div class="dossier-num">ČÍSLO #${t.id} • VÝSADEK ${t.wave.toUpperCase()}</div>
            <h4 class="dossier-name">${escapeHtml(t.name)}</h4>
            <div class="dossier-meta">
              Start: <strong>${t.start}</strong> (plán vlny ${t.wave_scheduled_start}) •
              Příchod: <strong>${t.arrival ? fmtClockAbs(t.arrival_abs_min) : "–"}</strong>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem;">
            ${statusBadge(t)}
            ${flags.join("")}
          </div>
        </div>

        <div class="dossier-ledger">
          <div class="dstat">
            <div class="dstat-k">Celkové pořadí</div>
            <div class="dstat-v" style="color:var(--signal-green);">${overallRankVal}</div>
            <div class="dstat-sub">${overallRankSub}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Pořadí ve výsadku</div>
            <div class="dstat-v">${waveRankVal}</div>
            <div class="dstat-sub">${waveRankSub}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Celkový čas</div>
            <div class="dstat-v">${t.total || "–"}</div>
            <div class="dstat-sub">${t.total_min !== null ? `Průměr závodu ${SUMMARY.avg_str}` : "Bez cílového času"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Rychlost &amp; Tempo</div>
            <div class="dstat-v">${t.speed_kmh ? `${fmtNumCz(t.speed_kmh)} km/h` : "–"}</div>
            <div class="dstat-sub">${t.pace_min_km ? `${t.pace_min_km} /km • ${speedDeltaStr}` : "Bez měřené rychlosti"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Medián rychlosti (závod)</div>
            <div class="dstat-v">${fmtNumCz(SUMMARY.median_speed_kmh)} km/h</div>
            <div class="dstat-sub">${SUMMARY.median_pace_str} /km (čas ${SUMMARY.median_str})</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Medián rychlosti (vlna)</div>
            <div class="dstat-v">${w && w.median_speed_kmh ? `${fmtNumCz(w.median_speed_kmh)} km/h` : "–"}</div>
            <div class="dstat-sub">${medianWaveStr}</div>
          </div>
        </div>

        ${
          t.total_min !== null
            ? `<div class="dist-bar-wrap">
                <div class="dist-bar-label">
                  <span>Rekord (${SUMMARY.fastest_str})</span>
                  <span>Medián (${SUMMARY.median_str})</span>
                  <span>Limit 18:00</span>
                  <span>Nejpomalejší (${SUMMARY.slowest_str})</span>
                </div>
                <div class="dist-bar">
                  <div class="dist-marker" style="left:${markerPct.toFixed(1)}%;" title="Pozice týmu"></div>
                </div>
              </div>`
            : `<p class="muted" style="margin:0; font-size:0.86rem;">Tento tým nemá v oficiální výsledkové listině zapsaný cílový čas.</p>`
        }
      </div>
    `;

    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("active", Number(c.dataset.id) === id);
    });
  }

  function initTeamSearch() {
    const input = document.getElementById("team-search");
    const ac = document.getElementById("team-autocomplete");
    const chipsBox = document.getElementById("quick-chips");

    const famousIds = [407, 344, 196, 332, 2, 94, 293, 347, 108, 248, 408];
    chipsBox.innerHTML = famousIds
      .map((id) => {
        const t = TEAM_BY_ID.get(id);
        return `<button class="chip" data-id="${id}" type="button">#${id} ${escapeHtml(
          t.name.length > 22 ? t.name.slice(0, 21) + "…" : t.name
        )}</button>`;
      })
      .join("");

    chipsBox.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      renderDossier(Number(btn.dataset.id));
    });

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        ac.classList.remove("open");
        return;
      }
      const matches = TEAMS.filter(
        (t) =>
          !t.is_unassigned &&
          (String(t.id) === q ||
            String(t.id).includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.wave.toLowerCase().includes(q))
      ).slice(0, 12);

      if (!matches.length) {
        ac.innerHTML = `<div class="ac-item muted">Žádný tým nenalezen</div>`;
      } else {
        ac.innerHTML = matches
          .map(
            (t) => `
          <div class="ac-item" data-id="${t.id}">
            <span><strong class="mono">#${t.id}</strong> ${escapeHtml(t.name)} <span class="muted">(${t.wave})</span></span>
            <span class="mono">${t.total || t.status}</span>
          </div>`
          )
          .join("");
      }
      ac.classList.add("open");
    });

    ac.addEventListener("click", (e) => {
      const item = e.target.closest(".ac-item");
      if (!item || !item.dataset.id) return;
      const id = Number(item.dataset.id);
      renderDossier(id);
      input.value = `#${id} ${TEAM_BY_ID.get(id).name}`;
      ac.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".input-box")) ac.classList.remove("open");
    });

    renderDossier(selectedTeamId);
  }

  // 4. Duel Simulator
  function initDuel() {
    const selA = document.getElementById("duel-a");
    const selB = document.getElementById("duel-b");
    const timed = TEAMS.filter((t) => t.total_min !== null).sort((a, b) => a.id - b.id);

    const optionsHtml = timed
      .map(
        (t) =>
          `<option value="${t.id}">#${t.id} ${escapeHtml(t.name)} (${t.wave}, ${t.total})</option>`
      )
      .join("");

    selA.innerHTML = optionsHtml;
    selB.innerHTML = optionsHtml;
    selA.value = "407";
    selB.value = "4";

    function updateDuel() {
      const a = TEAM_BY_ID.get(Number(selA.value));
      const b = TEAM_BY_ID.get(Number(selB.value));
      const out = document.getElementById("duel-output");
      if (!a || !b) return;

      const faster = a.total_min <= b.total_min ? a : b;
      const slower = a.total_min <= b.total_min ? b : a;
      const diffMin = slower.total_min - faster.total_min;
      const maxTime = Math.max(a.total_min, b.total_min);

      let overtakeMsg = "";
      if (a.id === b.id) {
        overtakeMsg = "Vybral jsi stejný tým proti sobě – shoda na každém kilometru.";
      } else {
        const va = 70 / a.total_min;
        const vb = 70 / b.total_min;
        if (Math.abs(va - vb) < 1e-9) {
          overtakeMsg = `Obě hlídky šly naprosto shodným tempem (${a.total}).`;
        } else {
          const tCross = (va * a.start_min - vb * b.start_min) / (va - vb);
          const kmCross = va * (tCross - a.start_min);
          if (kmCross > 0 && kmCross < 70) {
            overtakeMsg = `<strong>Předběhnutí na trati:</strong> <strong>${escapeHtml(
              faster.name
            )}</strong> odstartoval později (${faster.start}), ale při rovnoměrném tempu by dohnal a předběhl <strong>${escapeHtml(
              slower.name
            )}</strong> zhruba na <strong>${fmtNumCz(kmCross, 1)}. km</strong> kolem <strong>${fmtClockAbs(
              Math.round(tCross)
            )}</strong>.`;
          } else if (faster.arrival_abs_min < slower.arrival_abs_min) {
            overtakeMsg = `<strong>${escapeHtml(
              faster.name
            )}</strong> byl rychlejší o <strong>${fmtMin(
              diffMin
            )}</strong> a dorazil do cíle dříve (${fmtClockAbs(faster.arrival_abs_min)} vs. ${fmtClockAbs(
              slower.arrival_abs_min
            )}).`;
          } else {
            overtakeMsg = `<strong>${escapeHtml(
              faster.name
            )}</strong> šel o <strong>${fmtMin(
              diffMin
            )}</strong> čistého času rychleji, ale vzhledem k pozdějšímu startu (${faster.start} vs. ${slower.start}) dorazil do cíle později (${fmtClockAbs(
              faster.arrival_abs_min
            )}).`;
          }
        }
      }

      out.innerHTML = `
        <div class="duel-track">
          <div class="lane">
            <div class="lane-head">
              <span><strong>#${a.id} ${escapeHtml(a.name)}</strong> (${a.wave}, start ${a.start})</span>
              <span class="mono" style="color:var(--signal-green);">${a.total} (${fmtNumCz(a.speed_kmh)} km/h)</span>
            </div>
            <div class="lane-bar">
              <div class="lane-fill" style="width:${((a.total_min / maxTime) * 100).toFixed(1)}%; background:var(--signal-green);"></div>
            </div>
          </div>
          <div class="lane">
            <div class="lane-head">
              <span><strong>#${b.id} ${escapeHtml(b.name)}</strong> (${b.wave}, start ${b.start})</span>
              <span class="mono" style="color:var(--signal-amber);">${b.total} (${fmtNumCz(b.speed_kmh)} km/h)</span>
            </div>
            <div class="lane-bar">
              <div class="lane-fill" style="width:${((b.total_min / maxTime) * 100).toFixed(1)}%; background:var(--signal-amber);"></div>
            </div>
          </div>
        </div>
        <div class="duel-verdict">
          <div>${overtakeMsg}</div>
          <div class="muted" style="margin-top:0.35rem; font-size:0.82rem;">
            Celkový rozdíl: <strong>${fmtMin(diffMin)}</strong> (${faster.rank_overall}. vs. ${slower.rank_overall}. místo celkově • medián závodu ${fmtNumCz(SUMMARY.median_speed_kmh)} km/h).
          </div>
        </div>
      `;
    }

    selA.addEventListener("change", updateDuel);
    selB.addEventListener("change", updateDuel);
    updateDuel();
  }

  // 5. Night Live Simulator
  function initSimulator() {
    const slider = document.getElementById("sim-slider");
    const clock = document.getElementById("sim-clock");
    const playBtn = document.getElementById("sim-play");
    const speedSel = document.getElementById("sim-speed");
    const statsEl = document.getElementById("sim-stats");
    const tickerEl = document.getElementById("sim-ticker");

    const timedAll = TEAMS.filter((t) => t.arrival_abs_min !== null);
    const starters = TEAMS.filter((t) => t.status === "a" || t.status === "x");

    function renderSim(nowMin) {
      clock.textContent = fmtClockAbs(nowMin);

      const launchedWaves = WAVES.filter((w) => w.scheduled_min <= nowMin).length;
      const startedNow = starters.filter((t) => t.start_min !== null && t.start_min <= nowMin).length;
      const arrivedByNow = timedAll.filter((t) => t.arrival_abs_min <= nowMin && t.status === "a");
      const recent = arrivedByNow
        .filter((t) => t.arrival_abs_min > nowMin - 20)
        .sort((a, b) => b.arrival_abs_min - a.arrival_abs_min)
        .slice(0, 8);

      const onTrailEstimate = Math.max(0, startedNow - arrivedByNow.length);

      statsEl.innerHTML = `
        <div class="dstat">
          <div class="dstat-k">Vysazených vln</div>
          <div class="dstat-v" style="color:var(--signal-green);">${launchedWaves} / 26</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Odstartovalo hlídek</div>
          <div class="dstat-v">${startedNow} / ${SUMMARY.started}</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Aktuálně v terénu (a+x)</div>
          <div class="dstat-v" style="color:var(--signal-amber);">${onTrailEstimate}</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Již v cíli (měření)</div>
          <div class="dstat-v" style="color:var(--signal-green);">${arrivedByNow.length} / 292</div>
        </div>
      `;

      tickerEl.innerHTML = `
        <div class="muted" style="font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">
          Příchody do cíle (posledních 20 minut před ${fmtClockAbs(nowMin)}):
        </div>
        <div class="sim-ticker-list">
          ${
            recent.length
              ? recent
                  .map(
                    (t) =>
                      `<span class="badge ${t.under_18h ? "badge-a" : "badge-over"}">#${t.id} ${escapeHtml(
                        t.name
                      )} (${t.arrival}, čas ${t.total})</span>`
                  )
                  .join("")
              : `<span class="muted">V tomto 20minutovém okně žádný měřený příchod.</span>`
          }
        </div>
      `;
    }

    slider.addEventListener("input", () => renderSim(Number(slider.value)));

    playBtn.addEventListener("click", () => {
      if (simTimer) {
        clearInterval(simTimer);
        simTimer = null;
        playBtn.textContent = "Přehrát noc";
        return;
      }
      if (Number(slider.value) >= 2040) slider.value = "495";
      playBtn.textContent = "Pauza";
      simTimer = setInterval(() => {
        const step = 5 * Number(speedSel.value);
        let next = Number(slider.value) + step;
        if (next >= 2040) {
          next = 2040;
          clearInterval(simTimer);
          simTimer = null;
          playBtn.textContent = "Přehrát noc";
        }
        slider.value = String(next);
        renderSim(next);
      }, 120);
    });

    renderSim(Number(slider.value));

    const hours = [];
    for (let h = 21; h <= 34; h++) {
      const labelH = h % 24;
      const prefix = h >= 24 ? "NE" : "SO";
      const count = timedAll.filter(
        (t) => t.status === "a" && Math.floor(t.arrival_abs_min / 60) === h
      ).length;
      hours.push({ label: `${prefix} ${labelH}:00`, count });
    }

    new Chart(document.getElementById("chart-arrivals"), {
      type: "bar",
      data: {
        labels: hours.map((x) => x.label),
        datasets: [
          {
            label: "Týmů v cíli za hodinu",
            data: hours.map((x) => x.count),
            backgroundColor: hours.map((x) =>
              x.count >= 40 ? "rgba(224, 159, 62, 0.85)" : "rgba(62, 196, 150, 0.72)"
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#a8b2a5" }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "#a8b2a5" }, grid: { color: "rgba(255,255,255,0.06)" } },
        },
      },
    });
  }

  // 6. Charts (Histogram, Responsive Waves Alpha-Zulu, Scatter)
  function initCharts() {
    Chart.defaults.color = "#a8b2a5";
    Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";

    const finishers = TEAMS.filter((t) => t.status === "a" && t.total_min !== null);

    // Histogram
    const bins = [];
    for (let m = 630; m < 1350; m += 30) {
      const cnt = finishers.filter((t) => t.total_min >= m && t.total_min < m + 30).length;
      bins.push({
        label: `${fmtMin(m)}`,
        start: m,
        cnt,
      });
    }

    new Chart(document.getElementById("chart-histogram"), {
      type: "bar",
      data: {
        labels: bins.map((b) => b.label),
        datasets: [
          {
            label: "Počet týmů",
            data: bins.map((b) => b.cnt),
            backgroundColor: bins.map((b) =>
              b.start < 1080 ? "rgba(62, 196, 150, 0.76)" : "rgba(224, 159, 62, 0.82)"
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return `Čas ${fmtMin(bins[idx].start)} – ${fmtMin(bins[idx].start + 30)}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, autoSkip: false } },
          y: { grid: { color: "rgba(255,255,255,0.06)" } },
        },
      },
    });

    // Responsive Waves Chart (Alpha .. Zulu always visible; horizontal on mobile < 768px)
    function renderWaveChart(mode) {
      waveMode = mode;
      const isMobile = window.innerWidth < 768;
      lastWavesMobile = isMobile;

      const box = document.getElementById("waves-chart-box");
      box.classList.toggle("is-horizontal", isMobile);

      const ctx = document.getElementById("chart-waves");
      if (waveChart) waveChart.destroy();

      const catScale = {
        stacked: mode === "counts",
        ticks: {
          autoSkip: false,
          color: "#a8b2a5",
          font: { size: isMobile ? 11 : 10 },
          maxRotation: isMobile ? 0 : 60,
          minRotation: isMobile ? 0 : 50,
        },
        grid: { display: false },
      };

      const valScale = {
        stacked: mode === "counts",
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#a8b2a5" },
        title: mode === "times"
          ? { display: true, text: "Hodiny", color: "#a8b2a5" }
          : { display: false },
      };

      if (mode === "counts") {
        waveChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: WAVES.map((w) => w.wave),
            datasets: [
              {
                label: "V limitu ≤18h",
                data: WAVES.map((w) => w.under_18h),
                backgroundColor: "rgba(62, 196, 150, 0.8)",
              },
              {
                label: "Nad 18h",
                data: WAVES.map((w) => w.over_18h),
                backgroundColor: "rgba(224, 159, 62, 0.82)",
              },
              {
                label: "Nedokončili (x)",
                data: WAVES.map((w) => w.dnf),
                backgroundColor: "rgba(212, 180, 74, 0.82)",
              },
              {
                label: "Nedorazili (n)",
                data: WAVES.map((w) => w.dns),
                backgroundColor: "rgba(224, 108, 101, 0.8)",
              },
            ],
          },
          options: {
            indexAxis: isMobile ? "y" : "x",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { boxWidth: 12, color: "#a8b2a5", font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  afterBody: (items) => {
                    const w = WAVES[items[0].dataIndex];
                    return `Úspěšnost: ${fmtNumCz(w.success_rate, 1)} % (${w.finished}/${w.started}) • Medián ${w.median_str || "–"}`;
                  },
                },
              },
            },
            scales: isMobile
              ? { x: valScale, y: catScale }
              : { x: catScale, y: valScale },
          },
        });
      } else {
        waveChart = new Chart(ctx, {
          type: isMobile ? "bar" : "line",
          data: {
            labels: WAVES.map((w) => w.wave),
            datasets: [
              {
                label: "Průměrný čas (hod)",
                data: WAVES.map((w) => (w.avg_min ? +(w.avg_min / 60).toFixed(2) : null)),
                borderColor: "#e09f3e",
                backgroundColor: isMobile ? "rgba(224, 159, 62, 0.78)" : "rgba(224, 159, 62, 0.2)",
                tension: 0.25,
                pointRadius: 3.5,
              },
              {
                label: "Nejrychlejší čas (hod)",
                data: WAVES.map((w) => (w.best_min ? +(w.best_min / 60).toFixed(2) : null)),
                borderColor: "#3ec496",
                backgroundColor: isMobile ? "rgba(62, 196, 150, 0.8)" : "rgba(62, 196, 150, 0.2)",
                tension: 0.25,
                pointRadius: 3.5,
              },
            ],
          },
          options: {
            indexAxis: isMobile ? "y" : "x",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { boxWidth: 12, color: "#a8b2a5", font: { size: 11 } },
              },
            },
            scales: isMobile
              ? {
                  x: { ...valScale, min: 9, suggestedMax: 20 },
                  y: catScale,
                }
              : {
                  x: catScale,
                  y: valScale,
                },
          },
        });
      }
    }

    document.querySelectorAll("[data-wave-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-wave-mode]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderWaveChart(btn.dataset.waveMode);
      });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const nowMobile = window.innerWidth < 768;
        if (nowMobile !== lastWavesMobile) {
          renderWaveChart(waveMode);
        }
      }, 150);
    });

    renderWaveChart("counts");

    // Scatter Plot
    const scatterUnder = finishers
      .filter((t) => t.under_18h)
      .map((t) => ({ x: t.start_min / 60, y: t.total_min / 60, team: t }));
    const scatterOver = finishers
      .filter((t) => !t.under_18h)
      .map((t) => ({ x: t.start_min / 60, y: t.total_min / 60, team: t }));

    const scatterChart = new Chart(document.getElementById("chart-scatter"), {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "V limitu ≤ 18h (237)",
            data: scatterUnder,
            backgroundColor: "rgba(62, 196, 150, 0.78)",
            pointRadius: 4.5,
            pointHoverRadius: 7,
          },
          {
            label: "Nad limit > 18h (55)",
            data: scatterOver,
            backgroundColor: "rgba(224, 159, 62, 0.88)",
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_, elements) => {
          if (!elements.length) return;
          const el = elements[0];
          const ds = scatterChart.data.datasets[el.datasetIndex];
          const t = ds.data[el.index].team;
          renderDossier(t.id);
          document.getElementById("dossier").scrollIntoView({ behavior: "smooth" });
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const t = ctx.raw.team;
                return `#${t.id} ${t.name} (${t.wave}) • Start ${t.start} → Čas ${t.total} (${t.rank_overall}. místo)`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 8,
            max: 15,
            title: { display: true, text: "Čas startu (hodina v sobotu)", color: "#a8b2a5" },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          y: {
            min: 10,
            max: 23,
            title: { display: true, text: "Celkový čas na trati (hodiny)", color: "#a8b2a5" },
            grid: { color: "rgba(255,255,255,0.05)" },
          },
        },
      },
    });
  }

  // 7. Podium & Top 10
  function renderTop10() {
    const top10 = TEAMS.filter((t) => t.rank_overall !== null)
      .sort((a, b) => a.rank_overall - b.rank_overall || a.id - b.id)
      .slice(0, 10);

    const podiumClasses = ["gold", "", ""];
    const medals = ["1. MÍSTO CELKOVĚ", "2. MÍSTO CELKOVĚ", "3. MÍSTO CELKOVĚ"];

    document.getElementById("podium-grid").innerHTML = top10
      .slice(0, 3)
      .map(
        (t, idx) => `
      <div class="podium-card ${podiumClasses[idx]}" data-id="${t.id}">
        <div class="mono" style="font-size:0.76rem; color:var(--signal-amber);">${medals[idx]} • #${t.id} ${t.wave}</div>
        <h4 style="font-family:var(--font-display); font-size:1.22rem; margin:0.3rem 0;">${escapeHtml(t.name)}</h4>
        <div class="mono" style="font-size:1.5rem; font-weight:700; color:var(--signal-green);">${t.total}</div>
        <div class="muted" style="font-size:0.83rem;">Start ${t.start} → Cíl ${fmtClockAbs(t.arrival_abs_min)} • ${fmtNumCz(t.speed_kmh)} km/h (${t.pace_min_km} /km)</div>
      </div>`
      )
      .join("");

    document.getElementById("podium-grid").addEventListener("click", (e) => {
      const card = e.target.closest(".podium-card");
      if (!card) return;
      renderDossier(Number(card.dataset.id));
      document.getElementById("dossier").scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("top10-wrap").innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Pořadí</th>
              <th>Č.</th>
              <th>Název týmu</th>
              <th>Výsadek</th>
              <th>Start</th>
              <th>Příchod</th>
              <th>Celkový čas</th>
              <th>Rychlost</th>
              <th>Tempo</th>
            </tr>
          </thead>
          <tbody>
            ${top10
              .map(
                (t) => `
              <tr data-top-id="${t.id}">
                <td class="mono"><strong>${t.rank_overall}.</strong></td>
                <td class="mono">#${t.id}</td>
                <td><strong>${escapeHtml(t.name)}</strong></td>
                <td>${t.wave}</td>
                <td class="mono">${t.start}</td>
                <td class="mono">${fmtClockAbs(t.arrival_abs_min)}</td>
                <td class="mono" style="color:var(--signal-green);"><strong>${t.total}</strong></td>
                <td class="mono">${fmtNumCz(t.speed_kmh)} km/h</td>
                <td class="mono">${t.pace_min_km} /km</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("top10-wrap").addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-top-id]");
      if (!row) return;
      renderDossier(Number(row.dataset.topId));
      document.getElementById("dossier").scrollIntoView({ behavior: "smooth" });
    });
  }

  // 8. Complete 409-row Table
  function initTable() {
    const waveSel = document.getElementById("tbl-wave");
    const statusSel = document.getElementById("tbl-status");
    const searchInput = document.getElementById("tbl-search");
    const resetBtn = document.getElementById("tbl-reset");
    const tbody = document.getElementById("results-tbody");
    const countBadge = document.getElementById("table-count");

    WAVES.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.wave;
      opt.textContent = `${w.wave} (${w.scheduled_start}) – ${fmtNumCz(w.success_rate, 1)} %`;
      waveSel.appendChild(opt);
    });

    function renderRows() {
      const q = searchInput.value.trim().toLowerCase();
      const waveVal = waveSel.value;
      const stVal = statusSel.value;

      let rows = TEAMS.filter((t) => {
        if (waveVal !== "ALL" && t.wave !== waveVal) return false;
        if (stVal === "a" && t.status !== "a") return false;
        if (stVal === "under18" && t.under_18h !== true) return false;
        if (stVal === "over18" && t.under_18h !== false) return false;
        if (stVal === "x" && t.status !== "x") return false;
        if (stVal === "n" && t.status !== "n") return false;
        if (stVal === "jumper" && !t.wave_jumper) return false;
        if (stVal === "anomaly" && !t.anomaly && !t.is_unassigned) return false;
        if (q) {
          const hit =
            String(t.id).includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.wave.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      });

      const key = sortState.key;
      const dir = sortState.asc ? 1 : -1;
      rows.sort((a, b) => {
        const va = a[key];
        const vb = b[key];
        if (va === null || va === undefined || va === "") return 1;
        if (vb === null || vb === undefined || vb === "") return -1;
        if (typeof va === "string" && typeof vb === "string") {
          return va.localeCompare(vb, "cs") * dir;
        }
        return (va - vb) * dir;
      });

      countBadge.textContent = `Zobrazeno ${rows.length} z ${TEAMS.length} řádků`;

      tbody.innerHTML = rows
        .map(
          (t) => `
        <tr data-id="${t.id}" class="${t.id === selectedTeamId ? "selected-row" : ""}">
          <td class="mono">${t.rank_overall ? `${t.rank_overall}.` : "–"}</td>
          <td class="mono">${t.id}</td>
          <td>${t.wave}</td>
          <td class="mono">${t.start}${t.wave_jumper ? ` <span class="muted" title="Plán vlny ${t.wave_scheduled_start}">(mimo)</span>` : ""}</td>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td>${statusBadge(t)}</td>
          <td class="mono">${t.arrival || "–"}</td>
          <td class="mono"><strong>${t.total || "–"}</strong></td>
          <td class="mono">${t.speed_kmh ? `${fmtNumCz(t.speed_kmh)} km/h <span class="muted">(${t.pace_min_km})</span>` : "–"}</td>
        </tr>`
        )
        .join("");
    }

    document.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (sortState.key === key) {
          sortState.asc = !sortState.asc;
        } else {
          sortState.key = key;
          sortState.asc = key === "speed_kmh" ? false : true;
        }
        renderRows();
      });
    });

    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-id]");
      if (!tr) return;
      renderDossier(Number(tr.dataset.id));
      renderRows();
      document.getElementById("dossier").scrollIntoView({ behavior: "smooth" });
    });

    searchInput.addEventListener("input", renderRows);
    waveSel.addEventListener("change", renderRows);
    statusSel.addEventListener("change", renderRows);
    resetBtn.addEventListener("click", () => {
      searchInput.value = "";
      waveSel.value = "ALL";
      statusSel.value = "ALL";
      sortState = { key: "id", asc: true };
      renderRows();
    });

    renderRows();
  }

  // Boot: primárně živě z vysledky_2026.csv, se záložním window.MCSP_DATA
  async function boot() {
    const badge = document.getElementById("csv-status-badge");
    try {
      const resp = await fetch("vysledky_2026.csv", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const csvText = await resp.text();
      DATA = buildDatasetFromCSV(csvText);
      if (badge) badge.textContent = `Načteno živě z vysledky_2026.csv (${DATA.teams.length} řádků)`;
    } catch (err) {
      DATA = window.MCSP_DATA;
      if (badge) badge.textContent = `Načteno z offline archivu (${DATA.teams.length} řádků)`;
    }

    SUMMARY = DATA.summary;
    WAVES = DATA.waves;
    TEAMS = DATA.teams;
    TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));
    WAVE_BY_NAME = new Map(WAVES.map((w) => [w.wave, w]));

    initPatrol();
    renderKPIs();
    initTeamSearch();
    initDuel();
    initSimulator();
    initCharts();
    renderTop10();
    initTable();
  }

  boot();
})();
