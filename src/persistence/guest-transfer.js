// Explicit, offline guest-save rescue across origins. Never sends save data to a server.
export const GUEST_KEY = "lumenProgressV1";
export const MAX_BYTES = 1024 * 1024;
export function validateGuestSave(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Sauvegarde invalide");
  if (!value.solved || typeof value.solved !== "object" || Array.isArray(value.solved)) throw Error("Quêtes invalides");
  if (!value.badges || typeof value.badges !== "object" || Array.isArray(value.badges)) throw Error("Badges invalides");
  if (Object.keys(value).some(k => ["__proto__", "prototype", "constructor"].includes(k))) throw Error("Clé invalide");
  return value;
}
export function guestSavePresent(storage) {
  const raw = storage.getItem(GUEST_KEY);
  if (!raw) return false;
  const save = validateGuestSave(JSON.parse(raw));
  return Object.keys(save.solved).some(k => !!save.solved[k]) ||
    Object.keys(save.badges).length > 0 ||
    Object.keys(save.stars || {}).length > 0 ||
    Number(save.shards || 0) > 3 ||
    Number(save.xp || 0) > 0;
}
export function exportGuestSave(storage) {
  const raw = storage.getItem(GUEST_KEY);
  if (!raw || raw.length > MAX_BYTES) throw Error("Aucune sauvegarde exportable");
  validateGuestSave(JSON.parse(raw));
  return JSON.stringify({format:"lumen-guest-backup",version:1,createdAt:new Date().toISOString(),progress:JSON.parse(raw)});
}
export function importGuestSave(storage, contents) {
  if (typeof contents !== "string" || contents.length > MAX_BYTES) throw Error("Fichier trop volumineux");
  const envelope = JSON.parse(contents);
  if (envelope?.format !== "lumen-guest-backup" || envelope.version !== 1) throw Error("Ce fichier n'est pas une sauvegarde Lumen");
  const incoming = validateGuestSave(envelope.progress);
  // Never overwrite an existing guest save. A future merge workflow will handle this case.
  if (guestSavePresent(storage)) throw Error("Une progression existe déjà ici : import bloqué pour éviter toute perte");
  const existing = storage.getItem(GUEST_KEY);
  const backupKey = "lumenGuestBeforeImport_" + Date.now();
  if (existing !== null) storage.setItem(backupKey, existing);
  storage.setItem(GUEST_KEY, JSON.stringify(incoming));
  if (storage.getItem(GUEST_KEY) !== JSON.stringify(incoming)) throw Error("Échec de vérification de la sauvegarde");
  return {solved:Object.values(incoming.solved).filter(Boolean).length, backupKey:existing===null?null:backupKey};
}
