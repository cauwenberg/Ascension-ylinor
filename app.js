
const STORAGE_KEY = "ascension-heretique-v1";

const defaultState = {
  profile: { name: "Pierre", xp: 0, level: 1, xpStep: 100, gold: 0, discipline: 50 },
  quests: [
    {
      id: crypto.randomUUID(),
      title: "Sculpter le plafond",
      description: "Transformer les plaques en une voûte rocheuse continue.",
      type: "main",
      difficulty: "hard",
      xp: 120,
      gold: 30,
      bossId: "",
      damage: 0,
      done: false,
      createdAt: Date.now()
    },
    {
      id: crypto.randomUUID(),
      title: "Nettoyer la zone de chantier",
      description: "Aspirer les résidus et ranger les outils.",
      type: "side",
      difficulty: "easy",
      xp: 15,
      gold: 10,
      bossId: "",
      damage: 0,
      done: false,
      createdAt: Date.now()
    }
  ],
  bosses: [
    {
      id: crypto.randomUUID(),
      name: "La Voûte Inachevée",
      description: "Le plafond de la salle de bain résiste encore à sa métamorphose.",
      maxHp: 500,
      hp: 500,
      rewardXp: 500,
      rewardGold: 150,
      rewarded: false
    }
  ],
  rewards: [
    { id: crypto.randomUUID(), name: "Un épisode de SAO", cost: 30 },
    { id: crypto.randomUUID(), name: "Une soirée jeu sans culpabilité", cost: 80 },
    { id: crypto.randomUUID(), name: "Un petit achat plaisir", cost: 250 }
  ],
  journal: [],
  today: { date: todayKey(), positive: 0, penalties: 0 }
};

function todayKey() {
  return new Date().toISOString().slice(0,10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function ensureDay() {
  if (!state.today || state.today.date !== todayKey()) {
    state.today = { date: todayKey(), positive: 0, penalties: 0 };
  }
}

function rankFor(level) {
  const ranks = [
    "Novice des Cendres",
    "Porteur de Rune",
    "Disciple du Sénacle",
    "Sculpteur des Ombres",
    "Architecte Troglodyte",
    "Hérétique Ascendant",
    "Maître des Fragments",
    "Légende d’Ylinor"
  ];
  return ranks[Math.min(level - 1, ranks.length - 1)];
}

function xpNeeded(level) {
  return state.profile.xpStep * level;
}

function checkLevelUp() {
  while (state.profile.xp >= xpNeeded(state.profile.level)) {
    state.profile.xp -= xpNeeded(state.profile.level);
    state.profile.level += 1;
    log(`Niveau ${state.profile.level} atteint : ${rankFor(state.profile.level)}.`, "reward");
    toast("Niveau supérieur !");
  }
}

function log(message, type="info") {
  state.journal.unshift({
    id: crypto.randomUUID(),
    message,
    type,
    at: new Date().toISOString()
  });
  state.journal = state.journal.slice(0, 200);
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function difficultyLabel(v) {
  return ({easy:"Facile",medium:"Moyenne",hard:"Difficile",epic:"Épique"})[v] || v;
}

function questImpact(q) {
  return ({easy:0.4,medium:0.8,hard:1.2,epic:1.8})[q.difficulty] || .5;
}

function completeQuest(id) {
  ensureDay();
  const q = state.quests.find(x => x.id === id);
  if (!q || q.done) return;
  q.done = true;
  state.profile.xp += q.xp;
  state.profile.gold += q.gold;
  state.profile.discipline = Math.min(100, state.profile.discipline + (q.type === "main" ? 3 : 1));
  state.today.positive += questImpact(q);

  if (q.bossId && q.damage > 0) {
    damageBoss(q.bossId, q.damage, false);
  }

  log(`Quête accomplie : ${q.title} (+${q.xp} XP, +${q.gold} or).`, "reward");
  checkLevelUp();
  save();
}

function failQuest(id) {
  ensureDay();
  const q = state.quests.find(x => x.id === id);
  if (!q || q.done) return;
  const penalty = q.type === "main" ? 4 : 2;
  state.profile.discipline = Math.max(0, state.profile.discipline - penalty);
  state.today.penalties += q.type === "main" ? 1.2 : .5;
  log(`Quête abandonnée : ${q.title} (-${penalty} discipline).`, "penalty");
  state.quests = state.quests.filter(x => x.id !== id);
  save();
}

function deleteQuest(id) {
  state.quests = state.quests.filter(x => x.id !== id);
  save();
}

function damageBoss(id, amount, direct=true) {
  const b = state.bosses.find(x => x.id === id);
  if (!b || b.hp <= 0) return;
  b.hp = Math.max(0, b.hp - amount);
  if (direct) log(`${b.name} subit ${amount} dégâts.`, "info");
  if (b.hp === 0 && !b.rewarded) {
    b.rewarded = true;
    state.profile.xp += b.rewardXp;
    state.profile.gold += b.rewardGold;
    log(`Boss vaincu : ${b.name} (+${b.rewardXp} XP, +${b.rewardGold} or).`, "reward");
    checkLevelUp();
  }
  save();
}

function buyReward(id) {
  ensureDay();
  const r = state.rewards.find(x => x.id === id);
  if (!r) return;
  if (state.profile.gold < r.cost) {
    toast("Pas assez d’or.");
    return;
  }
  state.profile.gold -= r.cost;
  log(`Récompense achetée : ${r.name} (-${r.cost} or).`, "info");
  toast("Récompense débloquée.");
  save();
}

function scoreToday() {
  ensureDay();
  const raw = 3 + state.today.positive * 2 - state.today.penalties * 2;
  return Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
}

function scoreMessage(score) {
  if (score >= 9) return "Journée exceptionnelle. Les résultats sont nets.";
  if (score >= 8) return "Très bonne journée. La quête majeure a réellement progressé.";
  if (score >= 7) return "Bonne journée, mais il reste une marge évidente.";
  if (score >= 6) return "Journée correcte. Le minimum est dépassé, sans exploit.";
  if (score >= 5) return "Minimum syndical. Trop peu de progression concrète.";
  if (score >= 3) return "Journée faible. Les distractions ont dominé.";
  return "Échec du jour. Il faudra reprendre le contrôle demain.";
}

function renderHeader() {
  const p = state.profile;
  const need = xpNeeded(p.level);
  document.getElementById("playerName").textContent = p.name;
  document.getElementById("rankLabel").textContent = `Niveau ${p.level} · ${rankFor(p.level)}`;
  document.getElementById("xpText").textContent = `${p.xp} / ${need} XP`;
  document.getElementById("xpBar").style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
  document.getElementById("goldValue").textContent = p.gold;
  document.getElementById("disciplineValue").textContent = p.discipline;
}

function questCard(q) {
  const boss = state.bosses.find(b => b.id === q.bossId);
  return `
    <article class="quest ${q.type} ${q.done ? "done" : ""}">
      <h3>${escapeHtml(q.title)}</h3>
      <p class="muted">${escapeHtml(q.description || "Aucune description.")}</p>
      <div class="meta">
        <span class="badge">${difficultyLabel(q.difficulty)}</span>
        <span class="badge">+${q.xp} XP</span>
        <span class="badge">+${q.gold} or</span>
        ${boss ? `<span class="badge">⚔ ${escapeHtml(boss.name)} · ${q.damage} dégâts</span>` : ""}
      </div>
      <div class="actions">
        ${q.done ? `<button class="ghost small" disabled>Accomplie</button>` : `
          <button class="primary small complete" data-complete="${q.id}">Valider</button>
          <button class="danger-soft small" data-fail="${q.id}">Abandonner</button>
        `}
        <button class="ghost small delete" data-delete-quest="${q.id}">Supprimer</button>
      </div>
    </article>
  `;
}

function renderQuests() {
  const mains = state.quests.filter(q => q.type === "main");
  const sides = state.quests.filter(q => q.type === "side");
  document.getElementById("mainQuestList").innerHTML = mains.map(questCard).join("");
  document.getElementById("sideQuestList").innerHTML = sides.map(questCard).join("");
  document.getElementById("mainQuestWrap").classList.toggle("hidden", mains.length === 0);
  document.getElementById("emptyQuests").classList.toggle("hidden", state.quests.length > 0);

  document.querySelectorAll("[data-complete]").forEach(b => b.onclick = () => completeQuest(b.dataset.complete));
  document.querySelectorAll("[data-fail]").forEach(b => b.onclick = () => {
    if (confirm("Abandonner cette quête et perdre de la discipline ?")) failQuest(b.dataset.fail);
  });
  document.querySelectorAll("[data-delete-quest]").forEach(b => b.onclick = () => deleteQuest(b.dataset.deleteQuest));
}

function renderBosses() {
  const list = document.getElementById("bossList");
  list.innerHTML = state.bosses.map(b => {
    const pct = Math.round((b.hp / b.maxHp) * 100);
    return `
      <article class="boss ${b.hp === 0 ? "defeated" : ""}">
        <h3>${escapeHtml(b.name)}</h3>
        <p class="muted">${escapeHtml(b.description || "")}</p>
        <div class="boss-health">
          <div class="meta"><span>${b.hp} / ${b.maxHp} PV</span><span>${pct}%</span></div>
          <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="meta">
          <span class="badge">Butin : ${b.rewardXp} XP</span>
          <span class="badge">${b.rewardGold} or</span>
        </div>
        <div class="actions">
          ${b.hp > 0 ? `<button class="primary small" data-hit="${b.id}">Infliger des dégâts</button>` : `<button class="ghost small" disabled>Vaincu</button>`}
          <button class="ghost small delete" data-delete-boss="${b.id}">Supprimer</button>
        </div>
      </article>`;
  }).join("");
  document.getElementById("emptyBosses").classList.toggle("hidden", state.bosses.length > 0);

  document.querySelectorAll("[data-hit]").forEach(btn => btn.onclick = () => {
    const amount = Number(prompt("Combien de dégâts ?", "10"));
    if (Number.isFinite(amount) && amount > 0) damageBoss(btn.dataset.hit, Math.floor(amount));
  });
  document.querySelectorAll("[data-delete-boss]").forEach(btn => btn.onclick = () => {
    state.bosses = state.bosses.filter(b => b.id !== btn.dataset.deleteBoss);
    state.quests.forEach(q => { if (q.bossId === btn.dataset.deleteBoss) q.bossId = ""; });
    save();
  });
}

function renderShop() {
  document.getElementById("shopList").innerHTML = state.rewards.map(r => `
    <article class="reward">
      <h3>${escapeHtml(r.name)}</h3>
      <p class="muted">Coût : <strong>${r.cost} or</strong></p>
      <div class="actions">
        <button class="primary small" data-buy="${r.id}">Acheter</button>
        <button class="ghost small delete" data-delete-reward="${r.id}">Supprimer</button>
      </div>
    </article>
  `).join("");
  document.getElementById("emptyShop").classList.toggle("hidden", state.rewards.length > 0);

  document.querySelectorAll("[data-buy]").forEach(btn => btn.onclick = () => buyReward(btn.dataset.buy));
  document.querySelectorAll("[data-delete-reward]").forEach(btn => btn.onclick = () => {
    state.rewards = state.rewards.filter(r => r.id !== btn.dataset.deleteReward);
    save();
  });
}

function renderJournal() {
  const score = scoreToday();
  document.getElementById("dayScore").textContent = score;
  document.getElementById("scoreMessage").textContent = scoreMessage(score);
  document.getElementById("journalList").innerHTML = state.journal.map(entry => `
    <article class="log-entry ${entry.type === "penalty" ? "penalty" : ""}">
      <p>${escapeHtml(entry.message)}</p>
      <time>${new Date(entry.at).toLocaleString("fr-FR", {dateStyle:"short", timeStyle:"short"})}</time>
    </article>
  `).join("") || `<div class="empty">Aucune entrée dans le journal.</div>`;
}

function renderProfile() {
  document.getElementById("nameInput").value = state.profile.name;
  document.getElementById("xpStepInput").value = state.profile.xpStep;
  document.getElementById("goldInput").value = state.profile.gold;
  document.getElementById("disciplineInput").value = state.profile.discipline;
}

function renderBossOptions() {
  const select = document.getElementById("questBoss");
  const current = select.value;
  select.innerHTML = `<option value="">Aucun</option>` + state.bosses
    .filter(b => b.hp > 0)
    .map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  select.value = current;
}

function render() {
  ensureDay();
  renderHeader();
  renderQuests();
  renderBosses();
  renderShop();
  renderJournal();
  renderProfile();
  renderBossOptions();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === btn));
    document.querySelectorAll(".view").forEach(x => x.classList.toggle("active", x.id === btn.dataset.view));
  });
});

document.getElementById("addQuestBtn").onclick = () => document.getElementById("questDialog").showModal();
document.getElementById("addBossBtn").onclick = () => document.getElementById("bossDialog").showModal();
document.getElementById("addRewardBtn").onclick = () => document.getElementById("rewardDialog").showModal();

document.getElementById("questForm").addEventListener("submit", e => {
  e.preventDefault();
  state.quests.unshift({
    id: crypto.randomUUID(),
    title: document.getElementById("questTitle").value.trim(),
    description: document.getElementById("questDescription").value.trim(),
    type: document.getElementById("questType").value,
    difficulty: document.getElementById("questDifficulty").value,
    xp: Number(document.getElementById("questXp").value) || 0,
    gold: Number(document.getElementById("questGold").value) || 0,
    bossId: document.getElementById("questBoss").value,
    damage: Number(document.getElementById("questDamage").value) || 0,
    done: false,
    createdAt: Date.now()
  });
  e.target.reset();
  document.getElementById("questDialog").close();
  save();
});

document.getElementById("bossForm").addEventListener("submit", e => {
  e.preventDefault();
  const hp = Math.max(1, Number(document.getElementById("bossHp").value) || 100);
  state.bosses.unshift({
    id: crypto.randomUUID(),
    name: document.getElementById("bossName").value.trim(),
    description: document.getElementById("bossDescription").value.trim(),
    maxHp: hp,
    hp,
    rewardXp: Number(document.getElementById("bossRewardXp").value) || 0,
    rewardGold: Number(document.getElementById("bossRewardGold").value) || 0,
    rewarded: false
  });
  e.target.reset();
  document.getElementById("bossDialog").close();
  save();
});

document.getElementById("rewardForm").addEventListener("submit", e => {
  e.preventDefault();
  state.rewards.unshift({
    id: crypto.randomUUID(),
    name: document.getElementById("rewardName").value.trim(),
    cost: Math.max(1, Number(document.getElementById("rewardCost").value) || 1)
  });
  e.target.reset();
  document.getElementById("rewardDialog").close();
  save();
});

document.getElementById("profileForm").addEventListener("submit", e => {
  e.preventDefault();
  state.profile.name = document.getElementById("nameInput").value.trim() || "Sans-nom";
  state.profile.xpStep = Math.max(50, Number(document.getElementById("xpStepInput").value) || 100);
  state.profile.gold = Math.max(0, Number(document.getElementById("goldInput").value) || 0);
  state.profile.discipline = Math.max(0, Math.min(100, Number(document.getElementById("disciplineInput").value) || 0));
  toast("Profil sauvegardé.");
  save();
});

document.getElementById("resetDayBtn").onclick = () => {
  if (!confirm("Clore la journée et commencer un nouveau score ?")) return;
  log(`Journée close avec une note de ${scoreToday()}/10.`, "info");
  state.today = { date: todayKey(), positive: 0, penalties: 0 };
  state.quests.forEach(q => { if (q.done) q.done = false; });
  save();
};

document.getElementById("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ascension-heretique-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById("importInput").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = parsed;
    save();
    toast("Sauvegarde importée.");
  } catch {
    alert("Fichier de sauvegarde invalide.");
  }
});

document.getElementById("wipeBtn").onclick = () => {
  if (!confirm("Tout effacer définitivement sur cet appareil ?")) return;
  state = structuredClone(defaultState);
  save();
};

let deferredPrompt;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").classList.remove("hidden");
});
document.getElementById("installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").classList.add("hidden");
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
