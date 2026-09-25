(function () {
  "use strict";

  // ---------- Metadata ----------
  const CATEGORIES = {
    family: { name: "Family", nameId: "Keluarga di Rumah", emoji: "🏠", desc: "Ayah, Bunda, Kakak & Adik — percakapan sehari-hari di rumah." },
    kids:   { name: "Kids", nameId: "Untuk Anak", emoji: "🧸", desc: "Kalimat super pendek untuk Adik (3 th) & Kakak (6 th)." },
    office: { name: "Office", nameId: "Kantor — Tech Lead", emoji: "💼", desc: "Stand-up, code review, 1-on-1, incident, dan lainnya." },
    casual: { name: "Office Casual", nameId: "Kantor — Santai", emoji: "☕", desc: "Obrolan pantry, makan siang, hobi, dan momen kantor." },
  };

  const ROLE_META = {
    Dad:       { emoji: "👨", bg: "#dbeafe", fg: "#1d4ed8" },
    Mom:       { emoji: "👩", bg: "#fce7f3", fg: "#be185d" },
    Kakak:     { emoji: "🧒", bg: "#fef3c7", fg: "#b45309" },
    Adik:      { emoji: "👶", bg: "#dcfce7", fg: "#15803d" },
    Grandma:   { emoji: "👵", bg: "#ede9fe", fg: "#6d28d9" },
    Grandpa:   { emoji: "👴", bg: "#e0e7ff", fg: "#4338ca" },
    // Hindari emoji gabungan (ZWJ) — sebagian tidak tampil benar di Windows 10.
    Cashier:   { emoji: "🏪", bg: "#f1f5f9", fg: "#475569" },
    "Tech Lead": { emoji: "💻", bg: "#dbeafe", fg: "#1d4ed8" },
    Engineer:  { emoji: "⌨️", bg: "#dcfce7", fg: "#15803d" },
    Rina:      { emoji: "🌷", bg: "#dcfce7", fg: "#15803d" },
    Budi:      { emoji: "🔧", bg: "#fef3c7", fg: "#b45309" },
    Alex:      { emoji: "📟", bg: "#fae8ff", fg: "#a21caf" },
    PM:        { emoji: "📋", bg: "#fce7f3", fg: "#be185d" },
    Candidate: { emoji: "🙋", bg: "#fef3c7", fg: "#b45309" },
    "New Hire": { emoji: "🌱", bg: "#fef3c7", fg: "#b45309" },
    Director:  { emoji: "👔", bg: "#ede9fe", fg: "#6d28d9" },
    Sarah:     { emoji: "🌻", bg: "#fef9c3", fg: "#a16207" },
    Dimas:     { emoji: "⚽", bg: "#ccfbf1", fg: "#0f766e" },
    Waiter:    { emoji: "🍽️", bg: "#f1f5f9", fg: "#475569" },
  };
  const FALLBACK_ROLE = { emoji: "🙂", bg: "#f1f5f9", fg: "#475569" };

  const ALL = (window.CONVERSATIONS || []).slice();
  const app = document.getElementById("app");

  // ---------- Storage (aman bila localStorage diblokir) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("ep:" + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("ep:" + key, JSON.stringify(value)); } catch (e) { /* abaikan */ }
    },
  };

  const settings = {
    showTranslation: store.get("showTranslation", false),
    slow: store.get("slow", false),
  };
  let done = store.get("done", {});

  // ---------- Helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function roleMeta(role) { return ROLE_META[role] || FALLBACK_ROLE; }
  function byCategory(cat) { return ALL.filter((c) => c.category === cat); }
  function findConv(cat, id) { return ALL.find((c) => c.category === cat && c.id === id); }
  function normalize(s) {
    return s.toLowerCase().replace(/[’']/g, "'").replace(/[.,!?;:"]/g, "").replace(/\s+/g, " ").trim();
  }

  // ---------- Speech (Text-to-Speech bawaan browser) ----------
  const tts = {
    supported: "speechSynthesis" in window,
    voice: null,
    token: 0,
    pickVoice() {
      if (!this.supported) return;
      const voices = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
      this.voice =
        voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|online|google/i.test(v.name)) ||
        voices.find((v) => /en[-_]US/i.test(v.lang)) ||
        voices[0] || null;
    },
    stop() {
      this.token++;
      if (this.supported) speechSynthesis.cancel();
      document.querySelectorAll(".play.speaking").forEach((b) => b.classList.remove("speaking"));
    },
    // Mengembalikan Promise yang selesai saat kalimat selesai diucapkan.
    speak(text, rate) {
      if (!this.supported) return Promise.resolve();
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        if (this.voice) u.voice = this.voice;
        u.rate = rate || (settings.slow ? 0.7 : 1);
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    },
  };
  if (tts.supported) {
    tts.pickVoice();
    speechSynthesis.onvoiceschanged = () => tts.pickVoice();
  }

  // ---------- Top bar settings ----------
  const translationToggle = document.getElementById("toggle-translation");
  const speedBtn = document.getElementById("toggle-speed");

  function applySettings() {
    translationToggle.checked = settings.showTranslation;
    speedBtn.textContent = settings.slow ? "🐢 0.7x" : "▶ 1x";
    speedBtn.classList.toggle("active", settings.slow);
    document.querySelectorAll(".line .id").forEach((el) => {
      el.hidden = !settings.showTranslation && !el.dataset.peek;
    });
  }
  translationToggle.addEventListener("change", () => {
    settings.showTranslation = translationToggle.checked;
    store.set("showTranslation", settings.showTranslation);
    document.querySelectorAll(".line:not(.mine) .id").forEach((el) => delete el.dataset.peek);
    applySettings();
  });
  speedBtn.addEventListener("click", () => {
    settings.slow = !settings.slow;
    store.set("slow", settings.slow);
    applySettings();
  });

  // ---------- Views ----------
  function viewHome() {
    const cats = Object.keys(CATEGORIES).map((key) => {
      const c = CATEGORIES[key];
      const list = byCategory(key);
      const n = list.filter((x) => done[key + "/" + x.id]).length;
      const pct = list.length ? Math.round((n / list.length) * 100) : 0;
      return `
        <a class="card big-card cat-${key}" href="#/${key}">
          <div class="emoji">${c.emoji}</div>
          <div class="title">${esc(c.nameId)}</div>
          <div class="title-id">${esc(c.desc)}</div>
          <div class="meta">${n} / ${list.length} tema selesai</div>
          <div class="progress-bar"><span style="width:${pct}%"></span></div>
        </a>`;
    }).join("");

    app.innerHTML = `
      <h1>Let's practice English! 👋</h1>
      <p class="sub">Pilih kategori, baca percakapannya, dengarkan audionya, lalu praktikkan bergantian peran.</p>
      <input class="search" id="search" type="search" placeholder="Cari tema… (mis. breakfast, code review)">
      <div id="results"></div>
      <div class="grid" id="cats">${cats}</div>
      ${tts.supported ? "" : `<p class="empty">⚠️ Browser ini tidak mendukung suara (Text-to-Speech). Coba Chrome, Edge, atau Safari.</p>`}
    `;
    bindSearch(ALL, document.getElementById("cats"));
  }

  function convCard(c) {
    const key = c.category + "/" + c.id;
    return `
      <a class="card cat-${c.category}" href="#/${c.category}/${c.id}">
        ${done[key] ? `<span class="done" title="Sudah dilatih">✓</span>` : ""}
        <div class="emoji">${c.emoji || CATEGORIES[c.category].emoji}</div>
        <div class="title">${esc(c.title)}</div>
        <div class="title-id">${esc(c.titleId)}</div>
        <div class="meta">${c.lines.length} kalimat · ${c.level === "easy" ? "Mudah" : "Menengah"}</div>
      </a>`;
  }

  function bindSearch(pool, hideEl) {
    const input = document.getElementById("search");
    const results = document.getElementById("results");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        results.innerHTML = "";
        if (hideEl) hideEl.hidden = false;
        return;
      }
      const found = pool.filter((c) =>
        (c.title + " " + c.titleId + " " + c.lines.map((l) => l.en).join(" ")).toLowerCase().includes(q)
      );
      if (hideEl) hideEl.hidden = true;
      results.innerHTML = found.length
        ? `<div class="grid">${found.map(convCard).join("")}</div>`
        : `<p class="empty">Tidak ada tema yang cocok dengan “${esc(q)}”.</p>`;
    });
  }

  function viewCategory(cat) {
    const c = CATEGORIES[cat];
    if (!c) return viewNotFound();
    const list = byCategory(cat);
    app.innerHTML = `
      <a class="crumb" href="#/">← Semua kategori</a>
      <h1>${c.emoji} ${esc(c.nameId)}</h1>
      <p class="sub">${esc(c.desc)}</p>
      <input class="search" id="search" type="search" placeholder="Cari di ${esc(c.nameId)}…">
      <div id="results"></div>
      <div class="grid" id="list">${list.map(convCard).join("")}</div>
    `;
    bindSearch(list, document.getElementById("list"));
  }

  function viewNotFound() {
    app.innerHTML = `<p class="empty">Halaman tidak ditemukan. <a href="#/" style="color:var(--accent)">Kembali ke beranda</a></p>`;
  }

  // ---------- Conversation view ----------
  function viewConversation(cat, id) {
    const conv = findConv(cat, id);
    if (!conv) return viewNotFound();
    const key = cat + "/" + id;
    const catMeta = CATEGORIES[cat];

    const lines = conv.lines.map((l, i) => {
      const m = roleMeta(l.role);
      const side = conv.roles.indexOf(l.role) % 2 === 1 ? "right" : "";
      return `
        <div class="line ${side}" data-i="${i}" style="--role-bg:${m.bg};--role-fg:${m.fg}">
          <div class="avatar" aria-hidden="true">${m.emoji}</div>
          <div class="bubble" data-i="${i}">
            <div class="who">${esc(l.role)}</div>
            <div class="en">${esc(l.en)}</div>
            <div class="id" hidden>${esc(l.id)}</div>
            <div class="line-actions">
              <button class="play" data-i="${i}" title="Dengarkan" aria-label="Dengarkan">🔊</button>
            </div>
          </div>
        </div>`;
    }).join("");

    const vocab = (conv.vocab || []).map((v) => `
      <tr><td><button class="mini-play" data-say="${esc(v.en)}" aria-label="Dengarkan">🔊</button>${esc(v.en)}</td><td>${esc(v.id)}</td></tr>`).join("");

    const phrases = (conv.phrases || []).map((p) => `<li>${esc(p)}</li>`).join("");

    const mistakes = (conv.mistakes || []).map((m) => `
      <div class="mistake">
        <div>❌ <span class="wrong">${esc(m.wrong)}</span></div>
        <div>✅ <span class="right-ans">${esc(m.right)}</span></div>
        <div class="note">${esc(m.note)}</div>
      </div>`).join("");

    const tips = (conv.parentTips || []).map((t) => `<li>${esc(t)}</li>`).join("");

    const roleButtons = conv.roles.map((r) =>
      `<button class="chip role-pick" data-role="${esc(r)}">${roleMeta(r).emoji} ${esc(r)}</button>`
    ).join("");

    app.innerHTML = `
      <a class="crumb" href="#/${cat}">← ${esc(catMeta.nameId)}</a>
      <h1>${conv.emoji || catMeta.emoji} ${esc(conv.title)}</h1>
      <p class="sub">${esc(conv.titleId)}${conv.context ? " · " + esc(conv.context) : ""}</p>

      <div class="toolbar">
        <button class="btn primary" id="play-all">▶ Play all</button>
        <button class="btn" id="stop" hidden>⏹ Stop</button>
      </div>

      <div class="roleplay-box">
        <p>🎭 <b>Role-play:</b> pilih peranmu. Kalimatmu disembunyikan, peran lain dibacakan — giliranmu, ucapkan kalimatnya lalu tekan <b>Next</b>.</p>
        <div class="roles">${roleButtons}</div>
        <div class="toolbar" id="rp-controls" hidden>
          <button class="btn good" id="rp-next">Next ▶</button>
          <button class="btn" id="rp-reveal">👀 Show</button>
          <button class="btn" id="rp-exit">Keluar role-play</button>
        </div>
      </div>

      <div class="dialog">${lines}</div>

      ${vocab ? `<details class="panel" open><summary>📚 Vocabulary / Kosakata</summary><table class="vocab">${vocab}</table></details>` : ""}
      ${phrases ? `<details class="panel"><summary>🧩 Useful patterns / Pola kalimat</summary><ul>${phrases}</ul></details>` : ""}
      ${mistakes ? `<details class="panel"><summary>⚠️ Common mistakes / Kesalahan umum</summary>${mistakes}</details>` : ""}
      ${mistakes ? `<details class="panel" id="quiz-panel"><summary>✏️ Mini quiz: perbaiki kalimatnya</summary><div id="quiz"></div></details>` : ""}
      ${tips ? `<details class="panel" open><summary>👪 Tips untuk Ayah/Bunda</summary><ul class="tips">${tips}</ul></details>` : ""}

      <div class="finish">
        <button class="btn ${done[key] ? "" : "good"}" id="mark-done">${done[key] ? "✓ Sudah dilatih (batalkan)" : "✅ Tandai sudah dilatih"}</button>
      </div>
    `;

    applySettings();
    bindConversation(conv, key);
    if (mistakes) setupQuiz(conv.mistakes);
  }

  function bindConversation(conv, key) {
    const lineEls = [...document.querySelectorAll(".line")];
    const playAllBtn = document.getElementById("play-all");
    const stopBtn = document.getElementById("stop");
    const rpControls = document.getElementById("rp-controls");
    const rpNext = document.getElementById("rp-next");
    const rpReveal = document.getElementById("rp-reveal");
    let myRole = null;
    let waitNext = null;

    function setCurrent(i) {
      lineEls.forEach((el) => el.classList.toggle("current", +el.dataset.i === i));
      if (i >= 0) lineEls[i].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    async function sayLine(i, btn) {
      const b = btn || lineEls[i].querySelector(".play");
      b.classList.add("speaking");
      await tts.speak(conv.lines[i].en);
      b.classList.remove("speaking");
    }

    function running(on) {
      playAllBtn.hidden = on;
      stopBtn.hidden = !on;
    }

    function stopAll() {
      tts.stop();
      if (waitNext) { waitNext(false); waitNext = null; }
      setCurrent(-1);
      running(false);
    }

    // Klik bubble = intip/sembunyikan terjemahan satu kalimat
    document.querySelector(".dialog").addEventListener("click", (e) => {
      const play = e.target.closest(".play");
      if (play) {
        e.stopPropagation();
        if (waitNext) {
          // Role-play sedang menunggu giliranmu: putar ulang tanpa menghentikan alur
          if (tts.supported) speechSynthesis.cancel();
        } else {
          stopAll();
        }
        sayLine(+play.dataset.i, play);
        return;
      }
      const bubble = e.target.closest(".bubble");
      if (!bubble) return;
      const lineEl = bubble.closest(".line");
      if (lineEl.classList.contains("mine") && lineEl.dataset.hiddenText) {
        revealLine(lineEl);
        return;
      }
      if (settings.showTranslation) return;
      const idEl = bubble.querySelector(".id");
      if (idEl.dataset.peek) delete idEl.dataset.peek; else idEl.dataset.peek = "1";
      idEl.hidden = !idEl.dataset.peek;
    });

    document.querySelectorAll(".mini-play").forEach((b) =>
      b.addEventListener("click", () => { tts.stop(); tts.speak(b.dataset.say); })
    );

    playAllBtn.addEventListener("click", async () => {
      stopAll();
      const token = tts.token;
      running(true);
      for (let i = 0; i < conv.lines.length; i++) {
        if (token !== tts.token) return;
        setCurrent(i);
        await sayLine(i);
        await pause(350);
      }
      if (token === tts.token) { setCurrent(-1); running(false); }
    });
    stopBtn.addEventListener("click", stopAll);

    // ----- Role-play -----
    function hideMine() {
      lineEls.forEach((el) => {
        const i = +el.dataset.i;
        const mine = myRole && conv.lines[i].role === myRole;
        el.classList.toggle("mine", !!mine);
        const en = el.querySelector(".en");
        const idEl = el.querySelector(".id");
        if (mine) {
          el.dataset.hiddenText = "1";
          en.innerHTML = `<span class="hidden-text">🎤 Giliranmu… (klik untuk lihat)</span>`;
          idEl.dataset.peek = "1"; // tampilkan terjemahan sebagai petunjuk
          idEl.hidden = false;
        } else {
          delete el.dataset.hiddenText;
          en.textContent = conv.lines[i].en;
          delete idEl.dataset.peek;
          idEl.hidden = !settings.showTranslation;
        }
      });
    }

    function revealLine(el) {
      delete el.dataset.hiddenText;
      el.querySelector(".en").textContent = conv.lines[+el.dataset.i].en;
    }

    document.querySelectorAll(".role-pick").forEach((btn) => {
      btn.addEventListener("click", () => startRolePlay(btn.dataset.role));
    });

    async function startRolePlay(role) {
      stopAll();
      myRole = role;
      document.querySelectorAll(".role-pick").forEach((b) => b.classList.toggle("active", b.dataset.role === role));
      hideMine();
      rpControls.hidden = false;
      const token = tts.token;

      for (let i = 0; i < conv.lines.length; i++) {
        if (token !== tts.token) return;
        setCurrent(i);
        if (conv.lines[i].role === myRole) {
          rpNext.disabled = false;
          const cont = await new Promise((resolve) => { waitNext = resolve; });
          waitNext = null;
          rpNext.disabled = true;
          if (!cont || token !== tts.token) return;
          revealLine(lineEls[i]);
          await sayLine(i); // dengarkan versi yang benar setelah kamu mengucapkannya
        } else {
          rpNext.disabled = true;
          await sayLine(i);
        }
        await pause(300);
      }
      if (token === tts.token) setCurrent(-1);
    }

    rpNext.addEventListener("click", () => { if (waitNext) waitNext(true); });
    rpReveal.addEventListener("click", () => {
      const cur = lineEls.find((el) => el.classList.contains("current"));
      if (cur && cur.dataset.hiddenText) revealLine(cur);
    });
    document.getElementById("rp-exit").addEventListener("click", () => {
      stopAll();
      myRole = null;
      document.querySelectorAll(".role-pick").forEach((b) => b.classList.remove("active"));
      hideMine();
      rpControls.hidden = true;
    });

    // ----- Progress -----
    document.getElementById("mark-done").addEventListener("click", (e) => {
      if (done[key]) delete done[key]; else done[key] = Date.now();
      store.set("done", done);
      const b = e.currentTarget;
      b.textContent = done[key] ? "✓ Sudah dilatih (batalkan)" : "✅ Tandai sudah dilatih";
      b.classList.toggle("good", !done[key]);
    });
  }

  function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // ---------- Mini quiz ----------
  function setupQuiz(items) {
    const box = document.getElementById("quiz");
    const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
    let pos = 0;
    let score = 0;

    function render() {
      if (pos >= order.length) {
        box.innerHTML = `
          <p class="quiz-q">🎉 Selesai! Benar ${score} dari ${order.length}.</p>
          <div class="toolbar"><button class="btn" id="quiz-again">Ulangi</button></div>`;
        box.querySelector("#quiz-again").onclick = () => { pos = 0; score = 0; order.sort(() => Math.random() - 0.5); render(); };
        return;
      }
      const m = items[order[pos]];
      box.innerHTML = `
        <p class="quiz-count">Soal ${pos + 1} / ${order.length}</p>
        <p class="quiz-q">❌ <span class="wrong">${esc(m.wrong)}</span></p>
        <input class="quiz-input" id="quiz-input" placeholder="Tulis versi yang benar…" autocomplete="off">
        <div class="quiz-feedback" id="quiz-fb"></div>
        <div class="toolbar">
          <button class="btn primary" id="quiz-check">Cek</button>
          <button class="btn" id="quiz-show">Lihat jawaban</button>
          <button class="btn" id="quiz-next" hidden>Berikutnya ▶</button>
        </div>`;
      const input = box.querySelector("#quiz-input");
      const fb = box.querySelector("#quiz-fb");
      const nextBtn = box.querySelector("#quiz-next");
      let answered = false;

      function finish(correct) {
        if (answered) return;
        answered = true;
        if (correct) score++;
        fb.innerHTML = `
          <div>${correct ? "✅ Benar!" : "Jawaban:"} <span class="right-ans">${esc(m.right)}</span></div>
          <div class="note">${esc(m.note)}</div>`;
        nextBtn.hidden = false;
        tts.stop();
        tts.speak(m.right);
      }
      box.querySelector("#quiz-check").onclick = () => {
        if (!input.value.trim()) return;
        const ok = normalize(input.value) === normalize(m.right);
        if (ok) finish(true);
        else fb.innerHTML = `<span style="color:var(--bad)">Belum tepat, coba lagi atau lihat jawaban.</span>`;
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") box.querySelector("#quiz-check").click(); });
      box.querySelector("#quiz-show").onclick = () => finish(false);
      nextBtn.onclick = () => { pos++; render(); };
    }
    render();
  }

  // ---------- Router ----------
  function route() {
    tts.stop();
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts.length === 0) viewHome();
    else if (parts.length === 1) viewCategory(parts[0]);
    else viewConversation(parts[0], parts[1]);
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  applySettings();
  route();
})();
