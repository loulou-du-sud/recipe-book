import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DEFAULT_CATEGORIES = [
  "Asian", "African", "Middle Eastern", "Mediterranean",
  "European", "Latin American", "American", "Dessert", "Other",
];

// Firebase web config is not a secret — it's safe to commit. Access is
// controlled by the Firestore security rules, not by hiding this object.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDzH_aRriyK_GfaKGVOVut4T9_Wq9LDx1Q",
  authDomain: "recipes-ba8a8.firebaseapp.com",
  projectId: "recipes-ba8a8",
  storageBucket: "recipes-ba8a8.firebasestorage.app",
  messagingSenderId: "288662525390",
  appId: "1:288662525390:web:5602f7975aceb520d4879f",
};

const CONFIG_KEY = "recipeAppConfig";
const CUSTOM_CATEGORIES_KEY = "recipeAppCustomCategories";

let config = loadConfig();
let db = null;
let recipesCol = null;
let recipes = [];
let activeCategory = "all";
let searchTerm = "";
let editingId = null;
let viewingRecipe = null;

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function loadCustomCategories() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCustomCategory(name) {
  const list = loadCustomCategories();
  if (!list.includes(name)) {
    list.push(name);
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(list));
  }
}

function allCategories() {
  return [...DEFAULT_CATEGORIES, ...loadCustomCategories()];
}

// ---------- Firebase ----------

async function initFirebase() {
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  db = getFirestore(app);
  recipesCol = collection(db, "recipes");

  onSnapshot(query(recipesCol, orderBy("createdAt", "desc")), (snap) => {
    recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategoryTabs();
    renderGrid();
  }, (err) => {
    console.error(err);
    setStatus("connectionStatus", "Firebase error: " + err.message, "error");
  });
}

// ---------- Rendering ----------

function renderCategoryTabs() {
  const container = document.getElementById("categoryTabs");
  const usedCategories = [...new Set(recipes.map((r) => r.category).filter(Boolean))];
  const cats = ["all", ...usedCategories];
  container.innerHTML = "";
  for (const cat of cats) {
    const btn = document.createElement("button");
    btn.className = "tab" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat === "all" ? "All" : cat;
    btn.dataset.category = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderCategoryTabs();
      renderGrid();
    });
    container.appendChild(btn);
  }
}

function renderGrid() {
  const grid = document.getElementById("recipeGrid");
  const filtered = recipes.filter((r) => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory;
    const matchesSearch = !searchTerm ||
      (r.title || "").toLowerCase().includes(searchTerm) ||
      (r.ingredients || []).join(" ").toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = recipes.length === 0
      ? 'No recipes yet. Click "+ Add Recipe" to save your first one.'
      : "No recipes match your filters.";
    grid.appendChild(p);
    return;
  }

  for (const r of filtered) {
    const card = document.createElement("div");
    card.className = "recipe-card";
    card.innerHTML = `
      <span class="badge">${escapeHtml(r.category || "Other")}</span>
      <h3>${escapeHtml(r.title || "Untitled recipe")}</h3>
      <p>${(r.ingredients || []).length} ingredients · ${(r.steps || []).length} steps</p>
    `;
    card.addEventListener("click", () => openViewModal(r));
    grid.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Add/Edit modal ----------

function populateCategorySelect(selected) {
  const select = document.getElementById("categorySelect");
  select.innerHTML = "";
  for (const cat of allCategories()) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
  if (selected) select.value = selected;
}

function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "Add Recipe";
  document.getElementById("igUrlInput").value = "";
  document.getElementById("captionInput").value = "";
  document.getElementById("videoInput").value = "";
  document.getElementById("titleInput").value = "";
  document.getElementById("ingredientsInput").value = "";
  document.getElementById("stepsInput").value = "";
  document.getElementById("notesInput").value = "";
  document.getElementById("parseStatus").textContent = "";
  document.getElementById("deleteBtn").classList.add("hidden");
  populateCategorySelect();
  document.getElementById("recipeModal").classList.remove("hidden");
}

function openEditModal(r) {
  editingId = r.id;
  document.getElementById("modalTitle").textContent = "Edit Recipe";
  document.getElementById("igUrlInput").value = r.instagramUrl || "";
  document.getElementById("captionInput").value = r.caption || "";
  document.getElementById("videoInput").value = "";
  document.getElementById("titleInput").value = r.title || "";
  document.getElementById("ingredientsInput").value = (r.ingredients || []).join("\n");
  document.getElementById("stepsInput").value = (r.steps || []).join("\n");
  document.getElementById("notesInput").value = r.notes || "";
  document.getElementById("parseStatus").textContent = "";
  document.getElementById("deleteBtn").classList.remove("hidden");
  populateCategorySelect(r.category);
  document.getElementById("viewModal").classList.add("hidden");
  document.getElementById("recipeModal").classList.remove("hidden");
}

function closeRecipeModal() {
  document.getElementById("recipeModal").classList.add("hidden");
}

function setStatus(elId, text, kind) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = "status-text" + (kind ? " " + kind : "");
}

function extractFrames(file, numFrames = 5, maxWidth = 480) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const frames = [];
    let canvas, ctx;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Could not read that video file."));
    });

    video.addEventListener("loadedmetadata", async () => {
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx = canvas.getContext("2d");

      const duration = video.duration;
      try {
        for (let i = 0; i < numFrames; i++) {
          const t = (duration * (i + 0.5)) / numFrames;
          await seekTo(video, t);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          frames.push(dataUrl.split(",")[1]);
        }
        cleanup();
        resolve(frames);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  });
}

function seekTo(video, time) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

async function parseWithAI() {
  const caption = document.getElementById("captionInput").value.trim();
  const videoFile = document.getElementById("videoInput").files[0];

  if (!caption && !videoFile) {
    setStatus("parseStatus", "Paste the caption text or upload a video first.", "error");
    return;
  }
  if (!config.anthropicKey) {
    setStatus("parseStatus", "Add your Anthropic API key in Settings first.", "error");
    return;
  }

  setStatus("parseStatus", "Parsing with AI…");
  const parseBtn = document.getElementById("parseBtn");
  parseBtn.disabled = true;

  try {
    let frames = [];
    if (videoFile) {
      setStatus("parseStatus", "Extracting frames from video…");
      frames = await extractFrames(videoFile);
      setStatus("parseStatus", "Parsing with AI…");
    }

    const categories = allCategories();
    const promptText = `You extract recipe data from an Instagram post. You may be given the caption text and/or frames captured from the video (which may show on-screen ingredient lists or step text). Return ONLY strict JSON, no markdown fences, no commentary, matching this shape:
{"title": string, "category": one of [${categories.map((c) => `"${c}"`).join(", ")}], "ingredients": string[], "steps": string[]}

Rules:
- ingredients: one item per line, keep quantities if present.
- steps: clear, imperative, one action per step, in order.
- category: pick the single best fit from the allowed list.
- Combine information from the caption and the video frames — don't ignore either source.
- If there's no real recipe content, do your best guess from context but keep arrays possibly short.
${caption ? `\nCaption:\n"""\n${caption}\n"""` : "\n(No caption provided — rely on the video frames.)"}`;

    const content = [{ type: "text", text: promptText }];
    for (const frame of frames) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: frame },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: config.anthropicModel || "claude-sonnet-5",
        max_tokens: 1500,
        messages: [{ role: "user", content }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API error ${resp.status}: ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    const text = data.content.map((b) => b.text || "").join("").trim();
    const jsonText = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText);

    document.getElementById("titleInput").value = parsed.title || "";
    document.getElementById("ingredientsInput").value = (parsed.ingredients || []).join("\n");
    document.getElementById("stepsInput").value = (parsed.steps || []).join("\n");
    if (parsed.category) populateCategorySelect(parsed.category);

    setStatus("parseStatus", "Parsed! Review the fields below and edit anything that's off.", "success");
  } catch (err) {
    console.error(err);
    setStatus("parseStatus", "Failed to parse: " + err.message, "error");
  } finally {
    parseBtn.disabled = false;
  }
}

async function saveRecipe() {
  const title = document.getElementById("titleInput").value.trim();
  const category = document.getElementById("categorySelect").value;
  const instagramUrl = document.getElementById("igUrlInput").value.trim();
  const caption = document.getElementById("captionInput").value.trim();
  const ingredients = document.getElementById("ingredientsInput").value
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const steps = document.getElementById("stepsInput").value
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const notes = document.getElementById("notesInput").value.trim();

  if (!title) {
    alert("Please add a title.");
    return;
  }
  if (!db) {
    alert("Still connecting to Firebase — try again in a moment.");
    return;
  }

  const payload = { title, category, instagramUrl, caption, ingredients, steps, notes };

  if (editingId) {
    await updateDoc(doc(db, "recipes", editingId), payload);
  } else {
    await addDoc(recipesCol, { ...payload, createdAt: Date.now() });
  }
  closeRecipeModal();
}

async function deleteRecipe() {
  if (!editingId || !db) return;
  if (!confirm("Delete this recipe?")) return;
  await deleteDoc(doc(db, "recipes", editingId));
  closeRecipeModal();
}

// ---------- View modal ----------

function openViewModal(r) {
  viewingRecipe = r;
  document.getElementById("viewTitle").textContent = r.title || "Untitled recipe";
  const link = document.getElementById("viewIgLink");
  if (r.instagramUrl) {
    link.href = r.instagramUrl;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }
  document.getElementById("viewCategoryBadge").textContent = r.category || "Other";

  const ingList = document.getElementById("viewIngredients");
  ingList.innerHTML = "";
  for (const i of r.ingredients || []) {
    const li = document.createElement("li");
    li.textContent = i;
    ingList.appendChild(li);
  }

  const stepList = document.getElementById("viewSteps");
  stepList.innerHTML = "";
  for (const s of r.steps || []) {
    const li = document.createElement("li");
    li.textContent = s;
    stepList.appendChild(li);
  }

  const notesWrap = document.getElementById("viewNotesWrap");
  if (r.notes) {
    notesWrap.classList.remove("hidden");
    document.getElementById("viewNotes").textContent = r.notes;
  } else {
    notesWrap.classList.add("hidden");
  }

  document.getElementById("viewModal").classList.remove("hidden");
}

// ---------- Settings modal ----------

function openSettingsModal() {
  document.getElementById("anthropicKey").value = config.anthropicKey || "";
  document.getElementById("anthropicModel").value = config.anthropicModel || "claude-sonnet-5";
  document.getElementById("connectionStatus").textContent = db ? "Connected to Firebase." : "";
  document.getElementById("connectionStatus").className = db ? "status-text success" : "status-text";
  document.getElementById("settingsModal").classList.remove("hidden");
}

function saveSettings() {
  config = {
    anthropicKey: document.getElementById("anthropicKey").value.trim(),
    anthropicModel: document.getElementById("anthropicModel").value,
  };
  saveConfig(config);
  document.getElementById("settingsModal").classList.add("hidden");
}

// ---------- Wiring ----------

document.getElementById("addBtn").addEventListener("click", openAddModal);
document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);
document.getElementById("parseBtn").addEventListener("click", parseWithAI);
document.getElementById("saveBtn").addEventListener("click", saveRecipe);
document.getElementById("deleteBtn").addEventListener("click", deleteRecipe);
document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
document.getElementById("editFromViewBtn").addEventListener("click", () => openEditModal(viewingRecipe));

document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeRecipeModal));
document.querySelectorAll("[data-close-view]").forEach((el) =>
  el.addEventListener("click", () => document.getElementById("viewModal").classList.add("hidden")));
document.querySelectorAll("[data-close-settings]").forEach((el) =>
  el.addEventListener("click", () => document.getElementById("settingsModal").classList.add("hidden")));

document.getElementById("addCategoryBtn").addEventListener("click", () => {
  const input = document.getElementById("newCategoryInput");
  const select = document.getElementById("categorySelect");
  if (input.classList.contains("hidden")) {
    input.classList.remove("hidden");
    input.focus();
    return;
  }
  const name = input.value.trim();
  if (name) {
    saveCustomCategory(name);
    populateCategorySelect(name);
    input.value = "";
    input.classList.add("hidden");
  }
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderGrid();
});

// Close modals when clicking the overlay itself
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

// ---------- Init ----------

initFirebase().catch((err) => {
  console.error(err);
  alert("Could not connect to Firebase: " + err.message);
});
