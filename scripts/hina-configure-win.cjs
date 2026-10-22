// Credentials arrive on stdin and are saved only through Electron's secure store.
async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const connection = JSON.parse(input);
  if (!connection.token || /\s/.test(connection.token)) throw new Error("Invalid Connector token");
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  const target = targets.find((item) => item.type === "page" && item.url.includes("panel=true"));
  if (!target) throw new Error("Open Hina settings before connecting");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("DevTools unavailable")), {
      once: true,
    });
  });
  const timer = setTimeout(() => {
    socket.close();
    process.exitCode = 1;
  }, 135000);
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(data);
    if (response.id !== 1) return;
    clearTimeout(timer);
    const result = response.result?.result?.value;
    if (response.error || response.result?.exceptionDetails || !result?.ok) {
      console.error("Hina Connector configuration failed");
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result));
      socket.send(
        JSON.stringify({
          id: 2,
          method: "Runtime.evaluate",
          params: { expression: "location.reload()" },
        })
      );
    }
    socket.close();
  });
  socket.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
      const connection = ${JSON.stringify(connection)};
      const api = window.electronAPI;
      const check = await api.hinaConnectorRequest({ ...connection, check: true });
      if (!check.ok) return { ok: false };
      const saved = await api.saveDictationAgentCustomKey(connection.token);
      if (saved === false || saved?.success === false) return { ok: false };
      for (const [key, value] of Object.entries({
        hinaConnectorEnabled: 'true', hinaConnectorTransport: connection.transport,
        dictationAgentRemoteUrl: connection.url, dictationAgentMode: 'self-hosted',
        dictationAgentProvider: 'custom', dictationAgentModel: 'hina', useDictationAgent: 'true'
      })) localStorage.setItem(key, value);
      return { ok: true, transport: connection.transport };
    })()`,
      },
    })
  );
}

main().catch(() => {
  console.error("Hina Connector configuration failed");
  process.exitCode = 1;
});
