const PREFIX = 'lumenDailyGuestV1:';

// A receipt belongs to a single civil day and browser storage partition.
// Persist the request before transmitting it so a dropped response is replayed
// with the same event number and ID. Secrets never enter URLs or analytics.
export function createDailyGuestClient(client, { storage, locks, crypto, now = Date.now } = {}) {
  const read = day => {
    try { return JSON.parse(storage.getItem(PREFIX + day) || 'null'); }
    catch { return null; }
  };
  const write = (day, entry) => storage.setItem(PREFIX + day, JSON.stringify(entry));
  const serialized = (day, task) => locks?.request(PREFIX + day, task) ?? Promise.resolve(null);
  async function rpc(name, args) {
    const { data, error } = await client.rpc('lumen_daily_guest_' + name, args);
    if (error) throw Error(error.message);
    return data;
  }
  async function deliver(day, entry) {
    const result = await rpc('event', { p_day: day, p_key: entry.key, ...entry.pending });
    entry.pending = null;
    entry.result = result;
    write(day, entry);
    return result;
  }
  return {
    read: day => read(day)?.result ?? null,
    async begin(day) {
      if (!client || !crypto?.randomUUID) return null;
      return serialized(day, async () => {
        let entry = read(day);
        if (entry?.forfeited) return null;
        if (entry?.pending) return deliver(day, entry);
        if (['completed','abandoned','claimed'].includes(entry?.result?.status)) return entry.result;
        if (!entry) {
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          const key = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
          entry = { key };
          write(day, entry);
        }
        const result = await rpc('begin', { p_day: day, p_key: entry.key });
        entry.result = result;
        write(day, entry);
        return result;
      });
    },
    async event(day, action, columns = null) {
      return serialized(day, async () => {
        const entry = read(day);
        if (!entry || entry.forfeited) return null;
        if (entry.pending) {
          const wasSameAction = entry.pending.p_action === action;
          const result = await deliver(day, entry);
          if (wasSameAction || result?.status !== 'started') return result;
        }
        if (entry.result?.status !== 'started') return entry.result;
        entry.pending = {
          p_event: crypto.randomUUID(),
          p_number: entry.result.eventNumber + 1,
          p_action: action,
          p_columns: columns,
        };
        write(day, entry);
        return deliver(day, entry);
      });
    },
    forfeit(day) {
      const entry = read(day);
      if (entry) write(day, { ...entry, forfeited: true });
    },
    requestClaim(day) {
      const entry = read(day);
      if (entry?.result?.status !== 'completed') return false;
      entry.claimRequested = true;
      write(day, entry);
      return true;
    },
    signupReceipt(day) {
      const entry = read(day);
      return entry?.claimRequested && entry.result?.status === 'completed' ? { day, key: entry.key } : null;
    },
    requestedClaims() {
      const days = [];
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key?.startsWith(PREFIX)) continue;
          const day = key.slice(PREFIX.length), entry = read(day);
          if (entry?.claimRequested) days.push(day);
          else if (now() - Date.parse(day+'T12:00:00Z') > 3 * 86400000) storage.removeItem(key);
        }
      } catch {}
      return days.sort();
    },
    async claim(day, owner, isCurrent) {
      return serialized(day, async () => {
        const entry = read(day);
        if (!entry?.claimRequested || !isCurrent() || (entry.claimOwner && entry.claimOwner !== owner)) return null;
        entry.claimOwner = owner;
        write(day, entry);
        const result = await rpc('claim', { p_day: day, p_key: entry.key });
        if (!isCurrent()) return null;
        entry.claimRequested = false;
        write(day, entry);
        return result;
      });
    },
    claimBound: day => rpc('claim', { p_day: day, p_key: null }),
  };
}
