/**
 * Shared web/PWA language layer.
 * Intentionally conservative: translate only known interface copy, never user data.
 * Text emitted by JS should progressively migrate to explicit t(key) calls.
 */
export const SUPPORTED_LOCALES = Object.freeze(["fr", "en"]);
const STORAGE_KEY = "lumen.locale";
const COPY = {
  "Changement de compte": "Switching accounts",
  "Chargement de la progression de ce compte…": "Loading this account's progress…",
  "Réessayer": "Retry",
  "Se déconnecter": "Sign out",
  "Diagnostic": "Diagnostics",
  "Copier le diagnostic": "Copy diagnostics",
  "Quitter": "Exit",
  "Réinitialiser": "Reset",
  "Choisis ton pseudo ✨": "Choose your nickname ✨",
  "Pour retrouver ton identité dans le ciel et participer aux classements, choisis un pseudo unique.": "Choose a unique nickname to find your identity in the sky and appear in the rankings.",
  "Ton pseudo (3 à 20 caractères)": "Your nickname (3 to 20 characters)",
  "Continuer mon aventure": "Continue my adventure",
  "Données Lumen supprimées": "Lumen data deleted",
  "Déconnecte-toi pour jouer en invité ou crée un nouveau compte Lumen avec une autre adresse.": "Sign out to play as a guest, or create another Lumen account with a different email address.",
  "Sauvegarde ton aventure": "Save your adventure",
  "Un compte permet de poursuivre ton aventure et de retrouver tes acquis sur tous tes appareils.": "An account lets you continue your adventure and recover your progress on all your devices.",
  "Créer un compte": "Create an account",
  "Se connecter": "Sign in",
  "Adresse email": "Email address",
  "Mot de passe": "Password",
  "Créer mon compte →": "Create my account →",
  "Créer ou réinitialiser mon mot de passe": "Create or reset my password",
  "✉ Vérifie ta boîte e-mail": "✉ Check your email",
  "Changer d’adresse e-mail": "Change email address",
  "Retour au jeu": "Back to the game",
  "Garde LUMEN à portée de main": "Keep LUMEN close",
  "Ajoute LUMEN à ton écran d’accueil pour retrouver ton ciel en un geste.": "Add LUMEN to your home screen to return to your sky in one tap.",
  "Installer LUMEN": "Install LUMEN",
  "Plus tard": "Later",
  "Ton ciel peut t’appeler": "Your sky can call you back",
  "Active un rappel discret si tu n’as pas joué depuis 24 h. Maximum un rappel par semaine.": "Enable a gentle reminder after 24 hours away. At most one reminder per week.",
  "Activer le rappel": "Enable reminder",
  "Réessayer la synchronisation": "Retry sync",
  "Diagnostic de synchronisation": "Sync diagnostics",
  "Exporter mes sauvegardes": "Export my saves",
  "Fermer le diagnostic": "Close diagnostics",
  "Supprimer mes données Lumen": "Delete my Lumen data",
  "Tape SUPPRIMER pour confirmer": "Type SUPPRIMER to confirm",
  "Confirmer la suppression": "Confirm deletion",
  "Annuler": "Cancel",
  "Modifier mon profil": "Edit my profile",
  "Enregistrer le pseudo": "Save nickname",
  "Définir mon mot de passe": "Set my password",
  "Demander la suppression de mon compte": "Request account deletion",
  "Rejoindre le classement": "Join the leaderboard",
  "Retirer mes temps des classements": "Remove my times from leaderboards",
  "Terminer": "Done",
  "Tester comme nouveau joueur": "Test as a new player",
  "Réinitialiser la progression QA": "Reset QA progress",
  "Vérification en cours…": "Checking…",
  "↻ Rechercher une mise à jour": "↻ Check for updates",
  "Sauvegarder ma progression": "Save my progress",
  "Déconnexion": "Sign out",
  "Mes quêtes": "My quests",
  "Fermer": "Close",
  "Mon ciel": "My sky",
  "Quête suivante": "Next quest",
  "Pause": "Pause",
  "Abandonner": "Give up",
  "Passer le tutoriel": "Skip tutorial",
  "Suivant": "Next",
  "J’ai compris": "Got it",
  "Corriger": "Correct",
  "Jouer quand même": "Play anyway",
  "Comment gagner les badges ?": "How do I earn badges?",
  "Retour à Mon ciel": "Back to My Sky",
  "Recommencer": "Restart",
  "Admirer mon ciel": "Admire my sky",
  "Sans erreur": "No mistakes",
  "Sans assistance": "No assistance",
  "Rapidité": "Speed",
  "Maîtrise": "Mastery",
  "Autonomie": "Independence",
  "Commencer une nouvelle série": "Start a new streak",
  "SÉRIE DE LUMIÈRE": "STREAK OF LIGHT",
  "Ta lumière grandit !": "Your light is growing!",
  "Ta série s'est éteinte": "Your streak has ended",
  "Tu as manqué trop de jours.": "You've missed too many days.",
  "Ta prochaine quête relancera une nouvelle série.": "Your next quest will start a new streak.",
  "Comment fonctionne la Série de lumière ?": "How does the Streak of Light work?",
  "Un jour manqué est toléré : il protège ta série, mais ne compte pas comme un jour joué.": "One missed day is allowed: it protects your streak, but does not count as a day played.",
  "Prêt à voler de tes propres ailes ?": "Ready to fly on your own?",
  "J’essaie sans aide": "I'll try without help",
  "Garder le contrôle guidé": "Keep guided checks",
  "Marquage auto débloqué": "Auto-marking unlocked",
  "Mon aventure": "My adventure",
  "Mes défis": "My challenges",
};
const REVERSE = new Map(Object.entries(COPY).map(([fr, en]) => [en, fr]));
const originals = new WeakMap();
let locale = "fr";
let observer;

export function normalizeLocale(value) {
  return String(value || "").toLowerCase().split("-")[0] === "en" ? "en" : "fr";
}

export function getLocale() {
  return locale;
}

export function t(french, targetLocale = locale) {
  const source = REVERSE.get(french) || french;
  return normalizeLocale(targetLocale) === "en" ? (COPY[source] || source) : source;
}

function readPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch {
    // Private browsing or restricted local storage.
  }
  return normalizeLocale(navigator.language);
}

function translateTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const element = node.parentElement;
  if (!element || element.closest("script, style, textarea, code, pre, [contenteditable], [data-no-i18n]")) return;
  const raw = node.nodeValue;
  const value = raw.trim();
  if (!value) return;
  const known = COPY[value] || REVERSE.has(value);
  const original = originals.get(node);
  // A component may replace a text node's content: do not keep a stale source.
  if (original && raw !== original.rendered && raw !== original.raw) originals.delete(node);
  if (!known && !originals.has(node)) return;
  const source = originals.get(node)?.raw || raw;
  const trimmed = source.trim();
  if (!COPY[trimmed] && !REVERSE.has(trimmed)) return;
  const translated = t(trimmed);
  const updated = source.replace(trimmed, translated);
  originals.set(node, {raw: source, rendered: updated});
  if (raw !== updated) node.nodeValue = updated;
}

function translateAttributes(element) {
  if (!(element instanceof Element) || element.closest("[data-no-i18n]")) return;
  for (const name of ["aria-label", "title", "placeholder"]) {
    if (!element.hasAttribute(name)) continue;
    const value = element.getAttribute(name);
    if (!value || (!COPY[value] && !REVERSE.has(value))) continue;
    element.setAttribute(name, t(value));
  }
}

function translateTree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root);
  if (!(root instanceof Element) && root !== document) return;
  if (root instanceof Element) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) translateTextNode(walker.currentNode);
  if (root.querySelectorAll) root.querySelectorAll("[aria-label], [title], [placeholder]").forEach(translateAttributes);
}

function updateMetadata() {
  document.documentElement.lang = locale;
  document.title = locale === "en" ? "LUMEN — Constellation logic puzzle" : "LUMEN — Puzzle de lumière";
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = locale === "en"
    ? "An ad-free logic puzzle: place one Guardian per row, column and territory, and relight real constellations."
    : "Jeu de logique sans publicité : place un Gardien par ligne, par colonne et par territoire, et rallume les 88 vraies constellations du ciel. Gratuit pour commencer.";
}

export function setLocale(next) {
  locale = normalizeLocale(next);
  try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  updateMetadata();
  translateTree(document);
  const selector = document.getElementById("lumenLanguage");
  if (selector) selector.value = locale;
  document.dispatchEvent(new CustomEvent("lumen:localechange", {detail: {locale}}));
}

export function initI18n() {
  locale = readPreference();
  updateMetadata();
  const host = document.querySelector(".head-actions") || document.querySelector(".head");
  if (host && !document.getElementById("lumenLanguage")) {
    const label = document.createElement("label");
    label.className = "lumen-language";
    label.setAttribute("data-no-i18n", "");
    label.setAttribute("aria-label", "Language / Langue");
    label.style.cssText = "display:inline-flex;align-items:center;gap:4px";
    const select = document.createElement("select");
    select.id = "lumenLanguage";
    select.setAttribute("aria-label", "Language / Langue");
    select.style.cssText = "font:inherit;color:inherit;background:#152537;border:1px solid #64748b;border-radius:8px;padding:5px;max-width:78px";
    for (const [value, labelText] of [["fr", "FR"], ["en", "EN"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labelText;
      select.append(option);
    }
    select.value = locale;
    select.addEventListener("change", () => setLocale(select.value));
    label.append(select);
    host.append(label);
  }
  translateTree(document);
  observer?.disconnect();
  observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") translateTextNode(record.target);
      else if (record.type === "attributes") translateAttributes(record.target);
      else for (const node of record.addedNodes) translateTree(node);
    }
  });
  observer.observe(document.body, {subtree: true, childList: true, characterData: true});
}
