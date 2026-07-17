/* ============================================================
   OpenEduSite — moteur de recherche, filtres et affichage
   Aucune dépendance externe. Données : assets/data.json
   ============================================================ */

(function () {
  "use strict";

  // ---------- Dictionnaire de synonymes ----------
  // Permet qu'une recherche « élève » trouve ONDE, Pronote, etc.
  // clé = mot normalisé tapé par l'utilisateur → mots ajoutés à la requête
  const SYNONYMES = {
    "ent": ["espace-numerique", "cahier-de-textes", "messagerie"],
    "eleve": ["eleves", "liste-eleves", "gestion", "classe"],
    "eleves": ["eleve", "liste-eleves", "gestion", "classe"],
    "note": ["notes", "bulletins", "evaluation", "moyennes"],
    "notes": ["bulletins", "evaluation", "moyennes"],
    "prof": ["enseignant", "professeur"],
    "professeur": ["enseignant", "prof"],
    "instit": ["professeur-des-ecoles", "primaire"],
    "pe": ["professeur-des-ecoles", "primaire"],
    "absence": ["absences", "vie-scolaire", "appel"],
    "absences": ["vie-scolaire", "appel"],
    "devoirs": ["cahier-de-textes", "travail-a-faire", "exercices"],
    "exercice": ["exercices", "entrainement"],
    "exercices": ["entrainement", "autonomie"],
    "dictee": ["dictees", "orthographe", "francais"],
    "dictees": ["dictee", "orthographe", "francais"],
    "math": ["maths", "mathematiques", "calcul"],
    "maths": ["mathematiques", "calcul"],
    "francais": ["lecture", "grammaire", "orthographe", "lettres"],
    "quiz": ["qcm", "questionnaire", "jeu"],
    "jeu": ["jeux", "ludique", "quiz"],
    "jeux": ["jeu", "ludique", "quiz"],
    "revision": ["revisions", "entrainement"],
    "revisions": ["revision", "entrainement"],
    "mutation": ["carriere", "mouvement", "iprof"],
    "carriere": ["mutation", "promotion", "iprof"],
    "concours": ["crpe", "capes", "agregation", "recrutement"],
    "handicap": ["inclusion", "ash", "dys", "aesh"],
    "dys": ["dyslexie", "inclusion", "adaptation"],
    "orientation": ["parcoursup", "metiers", "onisep"],
    "stage": ["orientation", "troisieme", "entreprise"],
    "parents": ["familles", "coeducation"],
    "tableau": ["tbi", "vni", "affichage"],
    "cahier": ["cahier-de-textes", "cahier-journal"],
    "emploi": ["emploi-du-temps", "edt"],
    "salaire": ["paie", "remuneration", "ensap"],
    "formation": ["magistere", "autoformation", "canotech"],
    "programmes": ["officiel", "bo", "eduscol", "programmations"],
    "evaluation": ["evaluations", "competences", "livret"],
    "evaluations": ["evaluation", "competences", "livret"],
    "lecture": ["lire", "litterature", "comprehension"],
    "anglais": ["langues", "lv1", "english"],
    "histoire": ["histoire-geo", "geographie"],
    "sciences": ["physique", "chimie", "svt", "technologie"],
    "coding": ["programmation", "code", "scratch", "python"],
    "programmation": ["code", "scratch", "python", "algorithmique"],
    "ia": ["intelligence-artificielle"],
    "video": ["videos", "capsules"],
    "appel": ["absences", "cantine", "vie-scolaire"],
  };

  const NIVEAU_LABELS = {
    "tous": "Tous niveaux", "maternelle": "Maternelle", "cp": "CP",
    "ce1": "CE1", "ce2": "CE2", "cm1": "CM1", "cm2": "CM2",
    "college": "Collège", "lycee": "Lycée", "superieur": "Supérieur",
  };

  const PUBLIC_LABELS = {
    "enseignant": "Enseignants", "eleve": "Élèves",
    "parent": "Parents", "direction": "Direction",
  };

  // ---------- État ----------
  const state = {
    q: "",
    niveaux: new Set(),
    academie: "",
    categories: new Set(),
    publics: new Set(),
    officiel: false,
    gratuit: false,
    sort: "pertinence",
  };

  let DATA = { sites: [], categories: {}, academies: [], niveaux: [] };

  // ---------- Utilitaires ----------
  const $ = (sel) => document.querySelector(sel);

  function normalize(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[''`]/g, " ");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function academieLabel(slug) {
    return slug.split("-").map((w) =>
      w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w
    ).join("-").replace("La-reunion", "La Réunion").replace("Aix-Marseille", "Aix-Marseille");
  }

  // ---------- Recherche ----------
  function buildIndex() {
    for (const s of DATA.sites) {
      s._nom = normalize(s.nom);
      s._tags = s.tags.map(normalize);
      s._desc = normalize(s.description);
      s._cat = normalize(DATA.categories[s.categorie] || s.categorie);
    }
  }

  function expandQuery(tokens) {
    const extra = [];
    for (const t of tokens) {
      const syn = SYNONYMES[t];
      if (syn) extra.push(...syn.map(normalize));
    }
    return { direct: tokens, extra };
  }

  function scoreSite(site, direct, extra) {
    let score = 0;
    for (const t of direct) {
      // Les mots courts (< 4 lettres, ex. « ent ») n'utilisent que des
      // correspondances exactes ou de début de mot, sinon tout matche.
      const long = t.length >= 4;
      let hit = 0;
      if (site._nom === t) hit = Math.max(hit, 120);
      else if (site._nom.startsWith(t)) hit = Math.max(hit, 90);
      else if (long && site._nom.includes(t)) hit = Math.max(hit, 60);
      if (site._tags.some((tag) => tag === t)) hit = Math.max(hit, 70);
      else if (site._tags.some((tag) => long ? tag.includes(t) : tag.startsWith(t + "-"))) hit = Math.max(hit, 45);
      if (site.categorie === t || (long && site._cat.includes(t))) hit = Math.max(hit, 40);
      if (long && site._desc.includes(t)) hit = Math.max(hit, 25);
      if (hit === 0) return 0; // chaque mot direct doit correspondre
      score += hit;
    }
    for (const t of extra) {
      if (site._tags.some((tag) => tag.includes(t))) score += 20;
      else if (site._desc.includes(t) || site._nom.includes(t)) score += 10;
      else if (site.categorie === t) score += 15;
    }
    return score;
  }

  function applyFilters() {
    const qNorm = normalize(state.q).trim();
    const tokens = qNorm.split(/\s+/).filter(Boolean);
    const { direct, extra } = tokens.length ? expandQuery(tokens) : { direct: [], extra: [] };

    let results = [];
    for (const s of DATA.sites) {
      if (state.niveaux.size &&
          !s.niveaux.includes("tous") &&
          !s.niveaux.some((n) => state.niveaux.has(n))) continue;
      if (state.academie &&
          !s.academies.includes("toutes") &&
          !s.academies.includes(state.academie)) continue;
      if (state.categories.size && !state.categories.has(s.categorie)) continue;
      if (state.publics.size && !s.publics.some((p) => state.publics.has(p))) continue;
      if (state.officiel && !s.officiel) continue;
      if (state.gratuit && s.gratuit !== true) continue;

      if (direct.length) {
        const sc = scoreSite(s, direct, extra);
        if (sc <= 0) continue;
        results.push({ site: s, score: sc });
      } else {
        results.push({ site: s, score: 0 });
      }
    }

    const sort = state.sort;
    if (sort === "az" || (sort === "pertinence" && !direct.length)) {
      results.sort((a, b) => a.site.nom.localeCompare(b.site.nom, "fr"));
    } else if (sort === "za") {
      results.sort((a, b) => b.site.nom.localeCompare(a.site.nom, "fr"));
    } else if (sort === "categorie") {
      results.sort((a, b) =>
        (a.site._cat + a.site._nom).localeCompare(b.site._cat + b.site._nom, "fr"));
    } else {
      results.sort((a, b) => b.score - a.score ||
        a.site.nom.localeCompare(b.site.nom, "fr"));
    }
    return results.map((r) => r.site);
  }

  // ---------- Rendu ----------
  function cardHtml(s) {
    const cat = DATA.categories[s.categorie] || s.categorie;
    const niveaux = s.niveaux.includes("tous")
      ? "Tous niveaux"
      : s.niveaux.map((n) => NIVEAU_LABELS[n] || n).join(" · ");
    const acad = s.academies.includes("toutes")
      ? ""
      : " — Acad. " + s.academies.map(academieLabel).join(", ");
    const badges = [
      s.officiel ? '<span class="badge badge-officiel">Officiel</span>' : "",
      s.gratuit === false ? '<span class="badge badge-paid">Payant</span>' :
      s.gratuit === "partiel" ? '<span class="badge badge-paid">Freemium</span>' : "",
    ].join("");
    const tags = s.tags.slice(0, 6).map((t) =>
      `<button class="tag" data-q="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
    const initial = s.nom.trim().charAt(0).toUpperCase();

    return `<article class="card">
      <div class="card-head">
        <span class="card-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
        <div class="card-title">
          <h3><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.nom)}</a></h3>
          <span class="card-cat">${escapeHtml(cat)}</span>
        </div>
        <div class="badges">${badges}</div>
      </div>
      <p class="card-desc">${escapeHtml(s.description)}</p>
      <div class="card-tags">${tags}</div>
      <div class="card-foot">
        <span class="card-levels">${escapeHtml(niveaux + acad)}</span>
        <a class="card-visit" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">Visiter ↗</a>
      </div>
    </article>`;
  }

  let renderLimit = 60;
  let view = "cartes"; // "cartes" | "graphe" (graphe : réservé au thème Obsidian)

  function graphMode() {
    return view === "graphe" && document.documentElement.dataset.theme === "obsidian";
  }

  function render() {
    const sites = applyFilters();
    const gm = graphMode();
    $("#graph-wrap").hidden = !gm;
    $("#cards").hidden = gm;
    if (gm) {
      Graph.update(sites);
      $("#empty").hidden = sites.length > 0;
      $("#results-count").innerHTML = sites.length
        ? `<strong>${sites.length}</strong> site${sites.length > 1 ? "s" : ""} dans le graphe`
        : `Aucun résultat sur ${DATA.sites.length} sites référencés`;
      renderActiveFilters();
      return;
    }
    Graph.stop();
    const cards = $("#cards");
    const shown = sites.slice(0, renderLimit);
    cards.innerHTML = shown.map(cardHtml).join("");

    if (sites.length > renderLimit) {
      cards.insertAdjacentHTML("beforeend",
        `<button class="chip" id="show-more" style="grid-column:1/-1;padding:.7rem">
           Afficher les ${sites.length - renderLimit} autres résultats</button>`);
      $("#show-more").addEventListener("click", () => {
        renderLimit += 120;
        render();
      });
    }

    $("#empty").hidden = sites.length > 0;
    $("#results-count").innerHTML = sites.length
      ? `<strong>${sites.length}</strong> site${sites.length > 1 ? "s" : ""} trouvé${sites.length > 1 ? "s" : ""} sur ${DATA.sites.length}`
      : `Aucun résultat sur ${DATA.sites.length} sites référencés`;

    renderActiveFilters();
  }

  function renderActiveFilters() {
    const zone = $("#active-filters");
    const parts = [];
    if (state.q.trim()) parts.push({ label: `Recherche : « ${state.q.trim()} »`, clear: () => { setSearch(""); } });
    for (const n of state.niveaux) parts.push({ label: NIVEAU_LABELS[n] || n, clear: () => toggleSet(state.niveaux, n) });
    if (state.academie) parts.push({ label: "Acad. " + academieLabel(state.academie), clear: () => { state.academie = ""; $("#filter-academie").value = ""; } });
    for (const c of state.categories) parts.push({ label: DATA.categories[c] || c, clear: () => toggleSet(state.categories, c) });
    for (const p of state.publics) parts.push({ label: PUBLIC_LABELS[p] || p, clear: () => toggleSet(state.publics, p) });
    if (state.officiel) parts.push({ label: "Officiels", clear: () => { state.officiel = false; $("#filter-officiel").checked = false; } });
    if (state.gratuit) parts.push({ label: "Gratuits", clear: () => { state.gratuit = false; $("#filter-gratuit").checked = false; } });

    zone.hidden = parts.length === 0;
    zone.innerHTML = "";
    parts.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = "active-filter";
      btn.innerHTML = `<b>${escapeHtml(p.label)}</b> ✕`;
      btn.title = "Retirer ce filtre";
      btn.addEventListener("click", () => { p.clear(); syncChips(); resetAndRender(); });
      zone.appendChild(btn);
    });
  }

  function resetAndRender() {
    renderLimit = 60;
    render();
  }

  function toggleSet(set, value) {
    set.has(value) ? set.delete(value) : set.add(value);
  }

  // ---------- Construction des filtres ----------
  function buildFilters() {
    // Niveaux
    const nivZone = $("#filter-niveaux");
    for (const n of DATA.niveaux) {
      if (n === "tous") continue;
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = NIVEAU_LABELS[n] || n;
      b.dataset.value = n;
      b.addEventListener("click", () => {
        toggleSet(state.niveaux, n);
        b.classList.toggle("active");
        resetAndRender();
      });
      nivZone.appendChild(b);
    }

    // Académies
    const acadSel = $("#filter-academie");
    for (const a of DATA.academies) {
      const opt = document.createElement("option");
      opt.value = a;
      opt.textContent = academieLabel(a);
      acadSel.appendChild(opt);
    }
    acadSel.addEventListener("change", () => {
      state.academie = acadSel.value;
      resetAndRender();
    });

    // Catégories (avec compteurs)
    const counts = {};
    for (const s of DATA.sites) counts[s.categorie] = (counts[s.categorie] || 0) + 1;
    const catZone = $("#filter-categories");
    const cats = Object.entries(DATA.categories)
      .filter(([slug]) => counts[slug])
      .sort((a, b) => a[1].localeCompare(b[1], "fr"));
    for (const [slug, label] of cats) {
      const lab = document.createElement("label");
      lab.innerHTML = `<input type="checkbox" value="${slug}"> ${escapeHtml(label)}
                       <span class="count">${counts[slug]}</span>`;
      lab.querySelector("input").addEventListener("change", () => {
        toggleSet(state.categories, slug);
        resetAndRender();
      });
      catZone.appendChild(lab);
    }

    // Publics
    const pubZone = $("#filter-publics");
    for (const [slug, label] of Object.entries(PUBLIC_LABELS)) {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = label;
      b.dataset.value = slug;
      b.addEventListener("click", () => {
        toggleSet(state.publics, slug);
        b.classList.toggle("active");
        resetAndRender();
      });
      pubZone.appendChild(b);
    }

    // Interrupteurs
    $("#filter-officiel").addEventListener("change", (e) => {
      state.officiel = e.target.checked; resetAndRender();
    });
    $("#filter-gratuit").addEventListener("change", (e) => {
      state.gratuit = e.target.checked; resetAndRender();
    });

    // Réinitialisation
    const resetAll = () => {
      state.q = ""; $("#search").value = "";
      state.niveaux.clear(); state.categories.clear(); state.publics.clear();
      state.academie = ""; acadSel.value = "";
      state.officiel = false; $("#filter-officiel").checked = false;
      state.gratuit = false; $("#filter-gratuit").checked = false;
      syncChips();
      document.querySelectorAll("#filter-categories input").forEach((i) => (i.checked = false));
      resetAndRender();
    };
    $("#reset-filters").addEventListener("click", resetAll);
    $("#empty-reset").addEventListener("click", resetAll);
  }

  function syncChips() {
    document.querySelectorAll("#filter-niveaux .chip").forEach((c) =>
      c.classList.toggle("active", state.niveaux.has(c.dataset.value)));
    document.querySelectorAll("#filter-publics .chip").forEach((c) =>
      c.classList.toggle("active", state.publics.has(c.dataset.value)));
    document.querySelectorAll("#filter-categories input").forEach((i) =>
      (i.checked = state.categories.has(i.value)));
  }

  // ---------- Recherche : événements ----------
  function setSearch(value) {
    state.q = value;
    $("#search").value = value;
    resetAndRender();
  }

  function bindSearch() {
    let timer;
    $("#search").addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = e.target.value;
        resetAndRender();
      }, 120);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== $("#search") &&
          !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        $("#search").focus();
      }
      if (e.key === "Escape" && document.activeElement === $("#search")) {
        setSearch("");
      }
    });

    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-q]");
      if (target) {
        setSearch(target.dataset.q);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    $("#sort").addEventListener("change", (e) => {
      state.sort = e.target.value;
      resetAndRender();
    });
  }

  // ---------- Vue graphe façon Obsidian ----------
  // Simulation de forces maison sur canvas : les sites (petits nœuds)
  // sont reliés à leur catégorie (gros nœuds violets), comme le graphe
  // de l'application Obsidian.
  const Graph = (() => {
    let canvas, ctx, nodes = [], edges = [], raf = null;
    let panX = 0, panY = 0, scale = 1, hover = null, dragNode = null, panning = false;
    let lastX = 0, lastY = 0, colors = {};

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      colors = {
        bg: cs.getPropertyValue("--bg").trim(),
        accent: cs.getPropertyValue("--accent").trim() || "#a882ff",
        text: cs.getPropertyValue("--text").trim(),
        soft: cs.getPropertyValue("--text-soft").trim(),
        border: cs.getPropertyValue("--border").trim(),
      };
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function build(sites) {
      const capped = sites.slice(0, 300);
      const hubs = new Map();
      nodes = []; edges = [];
      for (const s of capped) {
        if (!hubs.has(s.categorie)) {
          hubs.set(s.categorie, nodes.length);
          nodes.push({ label: DATA.categories[s.categorie] || s.categorie,
                       cat: s.categorie, hub: true, r: 11, n: 0,
                       x: 0, y: 0, vx: 0, vy: 0 });
        }
        const h = hubs.get(s.categorie);
        nodes[h].n++;
        edges.push([h, nodes.length]);
        nodes.push({ label: s.nom, site: s, r: s.officiel ? 6 : 5,
                     x: 0, y: 0, vx: 0, vy: 0 });
      }
      // Taille des hubs selon leur nombre de sites, positions initiales en couronne
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      let i = 0;
      for (const [, h] of hubs) {
        const a = (2 * Math.PI * i++) / hubs.size;
        const n = nodes[h];
        n.r = 11 + Math.min(14, n.n * 0.6);
        n.x = cx + Math.cos(a) * 180; n.y = cy + Math.sin(a) * 180;
      }
      for (const [h, s] of edges) {
        const a = Math.random() * 2 * Math.PI, d = 40 + Math.random() * 60;
        nodes[s].x = nodes[h].x + Math.cos(a) * d;
        nodes[s].y = nodes[h].y + Math.sin(a) * d;
      }
      panX = 0; panY = 0; scale = 1;
    }

    function tick() {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      // Répulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { d2 = 1; dx = Math.random() - .5; dy = Math.random() - .5; }
          if (d2 > 40000) continue;
          const f = (a.hub || b.hub ? 900 : 350) / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      // Ressorts le long des liens
      for (const [h, s] of edges) {
        const a = nodes[h], b = nodes[s];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 70) * 0.02;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      // Gravité vers le centre + amortissement
      for (const n of nodes) {
        if (n === dragNode) { n.vx = 0; n.vy = 0; continue; }
        n.vx += (cx - n.x) * 0.002; n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += Math.max(-8, Math.min(8, n.vx));
        n.y += Math.max(-8, Math.min(8, n.vy));
      }
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(scale, scale);

      const neighbors = new Set();
      if (hover !== null) {
        neighbors.add(hover);
        for (const [h, s] of edges) {
          if (h === hover) neighbors.add(s);
          if (s === hover) neighbors.add(h);
        }
      }
      // Liens
      for (const [h, s] of edges) {
        const lit = hover === null || neighbors.has(h) && neighbors.has(s) &&
                    (h === hover || s === hover);
        ctx.strokeStyle = colors.accent;
        ctx.globalAlpha = lit ? (hover === null ? 0.18 : 0.6) : 0.05;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[h].x, nodes[h].y);
        ctx.lineTo(nodes[s].x, nodes[s].y);
        ctx.stroke();
      }
      // Nœuds
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dim = hover !== null && !neighbors.has(i);
        ctx.globalAlpha = dim ? 0.15 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI);
        ctx.fillStyle = n.hub ? colors.accent : (n.site && n.site.officiel ? "#8ab4f8" : colors.soft);
        ctx.fill();
        if (i === hover) {
          ctx.strokeStyle = colors.text; ctx.lineWidth = 1.5 / scale; ctx.stroke();
        }
      }
      // Libellés : taille constante À L'ÉCRAN (divisée par le zoom) pour
      // rester lisibles, et anti-chevauchement — les catégories d'abord,
      // puis les sites ; un libellé qui en recouvrirait un autre est masqué.
      ctx.textAlign = "center";
      const placed = [];
      const tryLabel = (i) => {
        const n = nodes[i];
        const dim = hover !== null && !neighbors.has(i);
        const px = (n.hub ? 12.5 : 10.5) / scale;
        const w = n.label.length * px * 0.6, h = px * 1.3;
        const x = n.x, y = n.y + n.r + 4 + px;
        for (const r of placed) {
          if (Math.abs(x - r.x) < (w + r.w) / 2 && Math.abs(y - r.y) < h) return;
        }
        placed.push({ x, y, w });
        ctx.globalAlpha = dim ? 0.15 : 1;
        ctx.font = (n.hub ? "600 " : "") + px + "px system-ui, sans-serif";
        ctx.fillStyle = n.hub ? colors.text : colors.soft;
        ctx.fillText(n.label, x, y);
      };
      for (let i = 0; i < nodes.length; i++) if (nodes[i].hub) tryLabel(i);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n.hub && (scale > 1.25 || neighbors.has(i))) tryLabel(i);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function loop() {
      tick(); draw();
      raf = requestAnimationFrame(loop);
    }

    function toWorld(evt) {
      const rect = canvas.getBoundingClientRect();
      return { x: (evt.clientX - rect.left - panX) / scale,
               y: (evt.clientY - rect.top - panY) / scale };
    }

    function nodeAt(p) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = p.x - n.x, dy = p.y - n.y;
        if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return i;
      }
      return null;
    }

    // Pointer Events : souris ET tactile (1 doigt = déplacer / toucher un
    // nœud, 2 doigts = pincer pour zoomer, tap = ouvrir ou filtrer).
    function bind() {
      const pointers = new Map();
      let pinchD = 0, tapStart = null;

      function zoomAt(cxClient, cyClient, factor) {
        const rect = canvas.getBoundingClientRect();
        const mx = cxClient - rect.left, my = cyClient - rect.top;
        const ns = Math.max(0.25, Math.min(6, scale * factor));
        panX = mx - ((mx - panX) / scale) * ns;
        panY = my - ((my - panY) / scale) * ns;
        scale = ns;
      }

      canvas.addEventListener("pointerdown", (e) => {
        canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          const i = nodeAt(toWorld(e));
          if (i !== null) dragNode = nodes[i];
          else { panning = true; canvas.classList.add("dragging"); }
          lastX = e.clientX; lastY = e.clientY;
          tapStart = { x: e.clientX, y: e.clientY };
        } else if (pointers.size === 2) {
          dragNode = null; panning = false; tapStart = null;
          const [a, b] = [...pointers.values()];
          pinchD = Math.hypot(a.x - b.x, a.y - b.y);
        }
      });

      canvas.addEventListener("pointermove", (e) => {
        if (pointers.has(e.pointerId)) {
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchD > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchD);
          pinchD = d;
          return;
        }
        if (dragNode) {
          const p = toWorld(e);
          dragNode.x = p.x; dragNode.y = p.y;
        } else if (panning) {
          panX += e.clientX - lastX; panY += e.clientY - lastY;
          lastX = e.clientX; lastY = e.clientY;
        } else if (e.pointerType === "mouse") {
          hover = nodeAt(toWorld(e));
          canvas.style.cursor = hover !== null ? "pointer" : "grab";
        }
      });

      canvas.addEventListener("pointerup", (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchD = 0;
        canvas.classList.remove("dragging");
        if (tapStart &&
            Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 6) {
          const i = nodeAt(toWorld(e));
          if (i !== null) {
            const n = nodes[i];
            if (n.site) window.open(n.site.url, "_blank", "noopener");
            else if (n.cat) {
              toggleSet(state.categories, n.cat);
              syncChips(); resetAndRender();
            }
          }
        }
        tapStart = null; dragNode = null; panning = false;
      });

      canvas.addEventListener("pointercancel", (e) => {
        pointers.delete(e.pointerId);
        pinchD = 0; dragNode = null; panning = false; tapStart = null;
      });

      canvas.addEventListener("pointerleave", () => { hover = null; });

      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.9);
      }, { passive: false });
      window.addEventListener("resize", () => { if (raf) resize(); });
    }

    return {
      update(sites) {
        if (!canvas) {
          canvas = $("#graph"); ctx = canvas.getContext("2d"); bind();
        }
        readColors(); resize(); build(sites);
        if (!raf) loop();
      },
      stop() {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        hover = null;
      },
    };
  })();

  function bindViewToggle() {
    document.querySelectorAll("#view-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        view = btn.dataset.view;
        document.querySelectorAll("#view-toggle button").forEach((b) =>
          b.classList.toggle("active", b === btn));
        resetAndRender();
      });
    });
  }

  // ---------- Thèmes ----------
  function bindThemes() {
    let saved = localStorage.getItem("oes-theme");
    if (saved === "obsidienne") saved = "obsidian"; // ancien nom du thème
    const preferred = saved ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair");
    setTheme(preferred);

    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.addEventListener("click", () => setTheme(btn.dataset.setTheme));
    });

    function setTheme(name) {
      document.documentElement.dataset.theme = name;
      localStorage.setItem("oes-theme", name);
      document.querySelectorAll("[data-set-theme]").forEach((b) =>
        b.classList.toggle("active", b.dataset.setTheme === name));
      // La vue graphe est propre au thème Obsidian : on l'active en entrant,
      // on revient aux cartes en sortant.
      const obsidian = name === "obsidian";
      $("#view-toggle").hidden = !obsidian;
      view = obsidian ? "graphe" : "cartes";
      document.querySelectorAll("#view-toggle button").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view));
      if (booted) resetAndRender();
    }
  }

  // ---------- Démarrage ----------
  let booted = false;

  async function init() {
    bindThemes();
    try {
      const resp = await fetch("assets/data.json");
      DATA = await resp.json();
    } catch (err) {
      $("#results-count").textContent =
        "Impossible de charger la base de données (assets/data.json).";
      return;
    }
    buildIndex();
    buildFilters();
    bindSearch();
    bindViewToggle();
    booted = true;
    $("#hero-count").textContent = `${DATA.sites.length} sites`;
    render();
  }

  init();
})();
