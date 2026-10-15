import { spawn } from "node:child_process";

// Use the public app-server protocol; session creation never targets the caller's chat.
export async function openCodexClient(command, root, { onNotification = () => {}, timeoutMs = 15000 } = {}) {
  const child = spawn(command, ["app-server"], { cwd: root, stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
  const pending = new Map();
  let nextId = 1, buffer = "", closing = false;
  const send = (message) => child.stdin.write(JSON.stringify(message) + "\n");
  const fail = (error) => {
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(error); }
    pending.clear();
    if (!closing) onNotification({ method: "client/closed", params: { code: String(error.code ?? "CONNECTION_CLOSED") } });
  };
  child.on("error", fail);
  child.on("exit", () => fail(Object.assign(new Error("Codex app-server closed"), { code: "CONNECTION_CLOSED" })));
  child.stdin.on("error", fail);
  child.stderr.resume();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 8 * 1024 * 1024) { fail(new Error("Codex response too large")); child.kill(); return; }
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { fail(new Error("Invalid Codex JSON response")); child.kill(); return; }
      if (message.method && message.id !== undefined) {
        // The integration never grants approvals or fabricates user answers.
        send({ id: message.id, error: { code: -32601, message: "Interactive input is unavailable in this background client. Report the required action in the chat." } });
        onNotification({ method: "client/needsAttention", params: { method: message.method } });
      } else if (message.id !== undefined) {
        const request = pending.get(message.id);
        if (!request) continue;
        pending.delete(message.id); clearTimeout(request.timer);
        if (message.error) request.reject(Object.assign(new Error(message.error.message), { code: message.error.code }));
        else request.resolve(message.result);
      } else onNotification(message);
    }
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error("Codex request timed out"), { code: "ETIMEDOUT" })); }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try { send({ id, method, params }); } catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
  });
  const close = () => { closing = true; child.stdin.end(); const timer = setTimeout(() => child.kill(), 1000); timer.unref(); child.once("exit", () => clearTimeout(timer)); };
  try {
    await call("initialize", { clientInfo: { name: "nori_review", title: "Nori Local Review", version: "1.0.0" } });
    send({ method: "initialized", params: {} });
  } catch (error) { close(); throw error; }
  return { call, close };
}
