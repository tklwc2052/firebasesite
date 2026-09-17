// Avern PartyKit browser client. All realtime transport and shared storage use PartyKit.
(() => {
  const SERVER_TIMESTAMP = { ".sv": "timestamp" };
  window.PARTYKIT_SERVER_TIMESTAMP = SERVER_TIMESTAMP;
  const listeners = new Map();
  const cache = { players: {}, world_breaks: {}, torches: {}, bomb_drops: {}, chat: {} };
  let connected = false;

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/party/main`);

  const emit = (path, event, key, value) => {
    const bucket = listeners.get(`${path}:${event}`) || [];
    for (const item of bucket) {
      if (event === "child_added" && item.startAtValue != null) {
        const stamp = value && typeof value === "object" ? value[item.orderField || "timestamp"] : 0;
        if (Number(stamp || 0) < item.startAtValue) continue;
      }
      item.callback(snapshot(key, value));
    }
  };

  const snapshot = (key, value) => ({ key, val: () => value });
  const send = (payload) => {
    const serialized = JSON.stringify(payload);
    if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
    else socket.addEventListener("open", () => socket.send(serialized), { once: true });
  };

  socket.addEventListener("open", () => {
    connected = true;
    for (const item of listeners.get(".info/connected:value") || []) item.callback(snapshot("connected", true));
  });

  socket.addEventListener("close", () => {
    connected = false;
    for (const item of listeners.get(".info/connected:value") || []) item.callback(snapshot("connected", false));
  });

  socket.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    if (msg.type === "snapshot") {
      Object.assign(cache.players, msg.players || {});
      for (const [name, values] of Object.entries(msg.collections || {})) {
        if (cache[name]) Object.assign(cache[name], values || {});
      }

      for (const [key, value] of Object.entries(cache.players)) emit("players", "child_added", key, value);
      for (const name of ["world_breaks", "torches", "bomb_drops", "chat"]) {
        let entries = Object.entries(cache[name]);
        if (name === "chat") entries = entries.slice(-20);
        for (const [key, value] of entries) emit(name, "child_added", key, value);
      }
      return;
    }

    if (msg.path && msg.key && msg.type?.startsWith("child_")) {
      if (msg.type === "child_removed") delete cache[msg.path]?.[msg.key];
      else if (cache[msg.path]) cache[msg.path][msg.key] = msg.value;
      emit(msg.path, msg.type, msg.key, msg.value);
    }
  });

  class Ref {
    constructor(path, query = {}) { this.path = path.replace(/^\/+|\/+$/g, ""); this.query = query; }
    orderByChild(field) { return new Ref(this.path, { ...this.query, orderField: field }); }
    startAt(value) { return new Ref(this.path, { ...this.query, startAtValue: value }); }
    limitToLast(value) { return new Ref(this.path, { ...this.query, limit: value }); }

    on(event, callback) {
      if (this.path === ".info/connected") {
        const id = `${this.path}:${event}`;
        if (!listeners.has(id)) listeners.set(id, []);
        listeners.get(id).push({ callback });
        queueMicrotask(() => callback(snapshot("connected", connected)));
        return callback;
      }
      const id = `${this.path}:${event}`;
      if (!listeners.has(id)) listeners.set(id, []);
      listeners.get(id).push({ callback, ...this.query });
      return callback;
    }

    once(event, callback) {
      if (event !== "value") return Promise.resolve(snapshot(null, null));
      const value = cache[this.path] || null;
      const snap = snapshot(this.path.split("/").pop(), value);
      if (callback) callback(snap);
      return Promise.resolve(snap);
    }

    update(value) { send({ type: "set", path: this.path, value }); return Promise.resolve(); }
    set(value) { return this.update(value); }

    push(value) {
      const key = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      const path = `${this.path}/${key}`;
      send({ type: "push", path: this.path, key, value });
      return { key, remove: () => new Ref(path).remove(), then: (resolve) => Promise.resolve({ key, remove: () => new Ref(path).remove() }).then(resolve) };
    }

    remove() { send({ type: "remove", path: this.path }); return Promise.resolve(); }
    onDisconnect() { return { remove: () => Promise.resolve() }; }
  }

  window.avernPartyKit = { ref: (path) => new Ref(path) };
})();
