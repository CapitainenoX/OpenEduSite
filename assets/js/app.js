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

  const AVATAR_COLORS = [
    "#3b5bdb", "#0b7285", "#087f5b", "#5f3dc4", "#c2255c",
    "#e8590c", "#5c940d", "#1971c2", "#862e9c", "#a61e4d",
  ];

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

  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
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
        <span class="card-avatar" style="background:${avatarColor(s.nom)}" aria-hidden="true">${escapeHtml(initial)}</span>
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

  function render() {
    const sites = applyFilters();
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

  // ---------- Thèmes ----------
  function bindThemes() {
    const saved = localStorage.getItem("oes-theme");
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
    }
  }

  // ---------- Démarrage ----------
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
    $("#hero-count").textContent = `${DATA.sites.length} sites`;
    render();
  }

  init();
})();
