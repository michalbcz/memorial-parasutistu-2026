(function () {
  "use strict";

  const DATA = window.MCSP_DATA;
  const SUMMARY = DATA.summary;
  const WAVES = DATA.waves;
  const TEAMS = DATA.teams;
  const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

  let selectedTeamId = 407; // Bleskový přesun
  let waveChart = null;
  let waveMode = "counts";
  let simTimer = null;
  let sortState = { key: "id", asc: true };

  // Helpers
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtMin(m) {
    if (m === null || m === undefined) return "–";
    const total = Math.round(m);
    const h = Math.floor(total / 60);
    const mm = total % 60;
    return `${h}:${mm < 10 ? "0" : ""}${mm}`;
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
      if (t.total_min !== null) return `<span class="badge badge-anom">x • s časem ${t.total}</span>`;
      return `<span class="badge badge-x">x • DNF</span>`;
    }
    if (t.status === "n") return `<span class="badge badge-n">n • DNS</span>`;
    return "";
  }

  // 1. Patrol Password Easter Egg
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
        input.style.borderColor = "var(--emerald)";
      } else {
        input.style.borderColor = "var(--red)";
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

  // 2. KPI Grid
  function renderKPIs() {
    const grid = document.getElementById("kpi-grid");
    const cards = [
      {
        cls: "",
        label: "Odstartovalo hlídek",
        value: SUMMARY.started,
        sub: `Z ${SUMMARY.total_rows} čísel (${SUMMARY.dns_named} DNS + 4 neobsazená + č. 410)`,
      },
      {
        cls: "cyan",
        label: "Dokončilo (Stav a)",
        value: `${SUMMARY.finished_total} (${SUMMARY.success_rate_pdf_pct} %)`,
        sub: `Přesně ${SUMMARY.success_rate_pct} % • ${SUMMARY.finished_untimed} bez zapsaného času`,
      },
      {
        cls: "emerald",
        label: "V 18h limitu (≤ 18:00)",
        value: SUMMARY.under_18h,
        sub: `${((SUMMARY.under_18h / SUMMARY.started) * 100).toFixed(1)} % startujících získalo medaili`,
      },
      {
        cls: "amber",
        label: "Nad limit (> 18:00)",
        value: SUMMARY.over_18h,
        sub: "Nejtěsnější smůla: #2 SPARTA II (18:01)",
      },
      {
        cls: "yellow",
        label: "Nedokončilo (DNF / x)",
        value: SUMMARY.dnf,
        sub: `${((SUMMARY.dnf / SUMMARY.started) * 100).toFixed(1)} % odpadlo na trase`,
      },
      {
        cls: "cyan",
        label: "Rekord & Průměr",
        value: SUMMARY.fastest_str,
        sub: `Průměr ${SUMMARY.avg_str} • Medián ${SUMMARY.median_str} • Nejdéle ${SUMMARY.slowest_str}`,
      },
    ];

    grid.innerHTML = cards
      .map(
        (c) => `
      <div class="kpi-card ${c.cls}">
        <div class="kpi-label">${c.label}</div>
        <div class="kpi-value">${c.value}</div>
        <div class="kpi-sub">${c.sub}</div>
      </div>`
      )
      .join("");
  }

  // 3. Team Dossier & Search
  function renderDossier(id) {
    const t = TEAM_BY_ID.get(id);
    if (!t) return;
    selectedTeamId = id;

    const container = document.getElementById("team-dossier");
    const diffAvg = t.total_min !== null ? t.total_min - SUMMARY.avg_min : null;
    const diffAvgStr =
      diffAvg === null
        ? "–"
        : `${diffAvg <= 0 ? "−" : "+"}${fmtMin(Math.abs(diffAvg))} vs. průměr`;

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
        `<span class="badge badge-anom">Skokan mimo vlnu (${t.wave} má ${t.wave_scheduled_start}, start ${t.start})</span>`
      );
    }
    if (t.anomaly === "dnf_with_time") {
      flags.push(`<span class="badge badge-anom">Anomálie: DNF (x) s časem v cíli!</span>`);
    }
    if (t.anomaly === "finisher_no_time") {
      flags.push(`<span class="badge badge-anom">Anomálie: Dokončil (a) bez času</span>`);
    }

    container.innerHTML = `
      <div class="dossier-card">
        <div class="dossier-head">
          <div>
            <div class="dossier-num">STARTOVNÍ ČÍSLO #${t.id} • VÝSADEK ${t.wave.toUpperCase()}</div>
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

        <div class="dossier-stats">
          <div class="dstat">
            <div class="dstat-k">Celkové pořadí</div>
            <div class="dstat-v" style="color:var(--cyan);">${t.rank_overall ? `${t.rank_overall}. / 292` : "–"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Pořadí ve výsadku</div>
            <div class="dstat-v">${t.rank_in_wave ? `${t.rank_in_wave}.` : "–"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Celkový čas</div>
            <div class="dstat-v">${t.total || "–"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Rychlost / Tempo</div>
            <div class="dstat-v" style="font-size:1.05rem;">${t.speed_kmh ? `${t.speed_kmh} km/h` : "–"}<br><span class="muted" style="font-size:0.78rem;">${t.pace_min_km ? `${t.pace_min_km} /km` : ""}</span></div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Percentil</div>
            <div class="dstat-v">${t.percentile !== null ? `Top ${(100 - t.percentile).toFixed(1)} %` : "–"}</div>
          </div>
          <div class="dstat">
            <div class="dstat-k">Rozdíl vs. průměr</div>
            <div class="dstat-v" style="font-size:0.98rem;">${diffAvgStr}</div>
          </div>
        </div>

        ${
          t.total_min !== null
            ? `<div class="dist-bar-wrap">
                <div class="dist-bar-label">
                  <span>Nejrychlejší (${SUMMARY.fastest_str})</span>
                  <span>Limit 18:00</span>
                  <span>Nejpomalejší (${SUMMARY.slowest_str})</span>
                </div>
                <div class="dist-bar">
                  <div class="dist-marker" style="left:${markerPct.toFixed(1)}%;" title="Pozice týmu"></div>
                </div>
              </div>`
            : `<p class="muted" style="margin:0; font-size:0.86rem;">Tento tým nemá v oficiální výsledkovce zapsaný cílový čas.</p>`
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
            <span>${t.total || t.status}</span>
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
    selA.value = "407"; // Bleskový přesun
    selB.value = "4";   // Sázavští zubři

    function updateDuel() {
      const a = TEAM_BY_ID.get(Number(selA.value));
      const b = TEAM_BY_ID.get(Number(selB.value));
      const out = document.getElementById("duel-output");
      if (!a || !b) return;

      const faster = a.total_min <= b.total_min ? a : b;
      const slower = a.total_min <= b.total_min ? b : a;
      const diffMin = slower.total_min - faster.total_min;
      const maxTime = Math.max(a.total_min, b.total_min);

      // Rovnoměrný model předběhnutí na 70 km trati
      let overtakeMsg = "";
      if (a.id === b.id) {
        overtakeMsg = "Vybral jsi stejný tým proti sobě – remíza na každém metru.";
      } else {
        const va = 70 / a.total_min; // km/min
        const vb = 70 / b.total_min;
        // Čas t_abs kdy se potkají: va*(t - start_a) == vb*(t - start_b)
        if (Math.abs(va - vb) < 1e-9) {
          overtakeMsg = `Oba týmy šly naprosto shodným tempem (${a.total})!`;
        } else {
          const tCross = (va * a.start_min - vb * b.start_min) / (va - vb);
          const kmCross = va * (tCross - a.start_min);
          if (kmCross > 0 && kmCross < 70) {
            overtakeMsg = `🏃 <strong>Předběhnutí na trati!</strong> <strong>${escapeHtml(
              faster.name
            )}</strong> odstartoval později (${faster.start}), ale při průměrném tempu by dohnal a předběhl <strong>${escapeHtml(
              slower.name
            )}</strong> zhruba na <strong>${kmCross.toFixed(1)}. km</strong> kolem <strong>${fmtClockAbs(
              Math.round(tCross)
            )}</strong>.`;
          } else if (faster.arrival_abs_min < slower.arrival_abs_min) {
            overtakeMsg = `⚡ <strong>${escapeHtml(
              faster.name
            )}</strong> byl rychlejší o <strong>${fmtMin(
              diffMin
            )}</strong> a dorazil do cíle dříve (${fmtClockAbs(faster.arrival_abs_min)} vs. ${fmtClockAbs(
              slower.arrival_abs_min
            )}).`;
          } else {
            overtakeMsg = `⏱️ <strong>${escapeHtml(
              faster.name
            )}</strong> šel o <strong>${fmtMin(
              diffMin
            )}</strong> čistého času rychleji, i když díky pozdějšímu startu (${faster.start} vs. ${slower.start}) dorazil do cíle později (${fmtClockAbs(
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
              <span class="mono" style="color:var(--cyan);">${a.total} (${a.speed_kmh} km/h)</span>
            </div>
            <div class="lane-bar">
              <div class="lane-fill" style="width:${((a.total_min / maxTime) * 100).toFixed(1)}%; background:var(--cyan);"></div>
            </div>
          </div>
          <div class="lane">
            <div class="lane-head">
              <span><strong>#${b.id} ${escapeHtml(b.name)}</strong> (${b.wave}, start ${b.start})</span>
              <span class="mono" style="color:var(--amber);">${b.total} (${b.speed_kmh} km/h)</span>
            </div>
            <div class="lane-bar">
              <div class="lane-fill" style="width:${((b.total_min / maxTime) * 100).toFixed(1)}%; background:var(--amber);"></div>
            </div>
          </div>
        </div>
        <div class="duel-verdict">
          <div>${overtakeMsg}</div>
          <div class="muted" style="margin-top:0.4rem; font-size:0.82rem;">
            Celkový rozdíl: <strong>${fmtMin(diffMin)}</strong> (${faster.rank_overall}. vs. ${slower.rank_overall}. místo celkově).
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
          <div class="dstat-v" style="color:var(--cyan);">${launchedWaves} / 26</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Odstartovalo hlídek</div>
          <div class="dstat-v">${startedNow} / ${SUMMARY.started}</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Aktuálně v terénu (a+x)</div>
          <div class="dstat-v" style="color:var(--amber);">${onTrailEstimate}</div>
        </div>
        <div class="dstat">
          <div class="dstat-k">Již v cíli (měření)</div>
          <div class="dstat-v" style="color:var(--emerald);">${arrivedByNow.length} / 292</div>
        </div>
      `;

      tickerEl.innerHTML = `
        <div class="muted" style="font-family:var(--font-mono); font-size:0.76rem; text-transform:uppercase;">
          📡 Právě dorazili do cíle (posledních 20 minut před ${fmtClockAbs(nowMin)}):
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
        playBtn.textContent = "▶ Přehrát noc";
        return;
      }
      if (Number(slider.value) >= 2040) slider.value = "495";
      playBtn.textContent = "⏸ Pauza";
      simTimer = setInterval(() => {
        const step = 5 * Number(speedSel.value);
        let next = Number(slider.value) + step;
        if (next >= 2040) {
          next = 2040;
          clearInterval(simTimer);
          simTimer = null;
          playBtn.textContent = "▶ Přehrát noc";
        }
        slider.value = String(next);
        renderSim(next);
      }, 120);
    });

    renderSim(Number(slider.value));

    // Hourly Arrivals Chart (21:00 Sat -> 10:00 Sun)
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
              x.count >= 40 ? "rgba(245, 158, 11, 0.8)" : "rgba(0, 229, 255, 0.65)"
            ),
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#b4c7ba" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#b4c7ba" }, grid: { color: "rgba(255,255,255,0.07)" } },
        },
      },
    });
  }

  // 6. Charts (Histogram, Waves, Scatter)
  function initCharts() {
    Chart.defaults.color = "#b4c7ba";
    Chart.defaults.font.family = "'Inter', sans-serif";

    const finishers = TEAMS.filter((t) => t.status === "a" && t.total_min !== null);

    // Histogram 30-min buckets from 10:30 (630) to 22:30 (1350)
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
              b.start < 1080 ? "rgba(0, 229, 255, 0.72)" : "rgba(245, 158, 11, 0.78)"
            ),
            borderRadius: 5,
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
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
          y: { grid: { color: "rgba(255,255,255,0.07)" } },
        },
      },
    });

    // Waves Chart
    function renderWaveChart(mode) {
      waveMode = mode;
      const ctx = document.getElementById("chart-waves");
      if (waveChart) waveChart.destroy();

      if (mode === "counts") {
        waveChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: WAVES.map((w) => w.wave),
            datasets: [
              {
                label: "V limitu ≤18h",
                data: WAVES.map((w) => w.under_18h),
                backgroundColor: "rgba(0, 229, 255, 0.75)",
              },
              {
                label: "Nad 18h",
                data: WAVES.map((w) => w.over_18h),
                backgroundColor: "rgba(245, 158, 11, 0.78)",
              },
              {
                label: "Nedokončili (x)",
                data: WAVES.map((w) => w.dnf),
                backgroundColor: "rgba(234, 179, 8, 0.78)",
              },
              {
                label: "Nedorazili (n)",
                data: WAVES.map((w) => w.dns),
                backgroundColor: "rgba(239, 68, 68, 0.75)",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              tooltip: {
                callbacks: {
                  afterBody: (items) => {
                    const w = WAVES[items[0].dataIndex];
                    return `Úspěšnost startujících: ${w.success_rate} % (${w.finished}/${w.started})`;
                  },
                },
              },
            },
            scales: {
              x: { stacked: true, ticks: { maxRotation: 60, minRotation: 45 } },
              y: { stacked: true, grid: { color: "rgba(255,255,255,0.07)" } },
            },
          },
        });
      } else {
        waveChart = new Chart(ctx, {
          type: "line",
          data: {
            labels: WAVES.map((w) => w.wave),
            datasets: [
              {
                label: "Průměrný čas vlny (hod)",
                data: WAVES.map((w) => (w.avg_min ? +(w.avg_min / 60).toFixed(2) : null)),
                borderColor: "#f59e0b",
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                tension: 0.25,
                pointRadius: 4,
              },
              {
                label: "Nejrychlejší čas vlny (hod)",
                data: WAVES.map((w) => (w.best_min ? +(w.best_min / 60).toFixed(2) : null)),
                borderColor: "#00e5ff",
                backgroundColor: "rgba(0, 229, 255, 0.2)",
                tension: 0.25,
                pointRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { ticks: { maxRotation: 60, minRotation: 45 } },
              y: { grid: { color: "rgba(255,255,255,0.07)" }, title: { display: true, text: "Hodiny" } },
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

    renderWaveChart("counts");

    // Scatter Plot: Start time vs Total time
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
            backgroundColor: "rgba(0, 229, 255, 0.72)",
            pointRadius: 4.5,
            pointHoverRadius: 7,
          },
          {
            label: "Nad limit > 18h (55)",
            data: scatterOver,
            backgroundColor: "rgba(245, 158, 11, 0.85)",
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
            title: { display: true, text: "Čas startu (hodina v sobotu)" },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
          y: {
            min: 10,
            max: 23,
            title: { display: true, text: "Celkový čas na trati (hodiny)" },
            grid: { color: "rgba(255,255,255,0.06)" },
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

    const podiumClasses = ["gold", "silver", "bronze"];
    const medals = ["🥇 1. MÍSTO", "🥈 2. MÍSTO", "🥉 3. MÍSTO"];

    document.getElementById("podium-grid").innerHTML = top10
      .slice(0, 3)
      .map(
        (t, idx) => `
      <div class="podium-card ${podiumClasses[idx]}" data-id="${t.id}">
        <div class="mono" style="font-size:0.78rem; color:var(--amber);">${medals[idx]} • #${t.id} ${t.wave}</div>
        <h4 style="font-family:var(--font-display); font-size:1.25rem; margin:0.3rem 0;">${escapeHtml(t.name)}</h4>
        <div class="mono" style="font-size:1.55rem; font-weight:700; color:var(--cyan);">${t.total}</div>
        <div class="muted" style="font-size:0.83rem;">Start ${t.start} → Cíl ${fmtClockAbs(t.arrival_abs_min)} • ${t.speed_kmh} km/h (${t.pace_min_km} /km)</div>
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
                <td class="mono" style="color:var(--cyan);"><strong>${t.total}</strong></td>
                <td class="mono">${t.speed_kmh} km/h</td>
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

  // 8. Complete 409-row Interactive Table
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
      opt.textContent = `${w.wave} (${w.scheduled_start}) – ${w.success_rate} %`;
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
          <td class="mono">${t.start}${t.wave_jumper ? ` <span title="Plán vlny ${t.wave_scheduled_start}">⚡</span>` : ""}</td>
          <td><strong>${escapeHtml(t.name)}</strong></td>
          <td>${statusBadge(t)}</td>
          <td class="mono">${t.arrival || "–"}</td>
          <td class="mono"><strong>${t.total || "–"}</strong></td>
          <td class="mono">${t.speed_kmh ? `${t.speed_kmh} km/h <span class="muted">(${t.pace_min_km})</span>` : "–"}</td>
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

  // Boot
  initPatrol();
  renderKPIs();
  initTeamSearch();
  initDuel();
  initSimulator();
  initCharts();
  renderTop10();
  initTable();
})();
