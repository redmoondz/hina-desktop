// A single real agent turn, authorized by the operator. Credentials arrive on
// stdin, remain in memory, and are never included in output or screenshots.
async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const connection = JSON.parse(input);
  connection.asset = require("node:fs")
    .readdirSync(require("node:path").join(__dirname, "../src/dist/assets"))
    .find((name) => /^ReasoningService-.*\.js$/.test(name));
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  const target = targets.find((item) => item.url.includes("panel=true"));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  socket.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
      const connection = ${JSON.stringify(connection)};
      const check = await window.electronAPI.hinaConnectorRequest({ ...connection, check: true });
      if (!check.ok) throw new Error(check.error);
      const mod = await import(new URL('./assets/' + connection.asset, location.href).href);
      const service = Object.values(mod).find(value => value && typeof value.processTextStreamingAI === 'function');
      if (!service) throw new Error('Packaged ReasoningService not found');
      const previous = localStorage.getItem('hinaConnectorEnabled');
      const previousTransport = localStorage.getItem('hinaConnectorTransport');
      localStorage.setItem('hinaConnectorEnabled', 'true');
      localStorage.setItem('hinaConnectorTransport', connection.transport || 'local');
      const chunks = [];
      try {
        for await (const chunk of service.processTextStreamingAI([{ role: 'user', content: 'Reply exactly: HINA_CONNECTION_OK' }], 'hina', 'custom', { inferenceScope: 'dictationAgent', lanUrl: connection.url, customApiKey: connection.token, systemPrompt: 'Assistant' }, {})) chunks.push(chunk);
      } finally {
        if (previous === null) localStorage.removeItem('hinaConnectorEnabled'); else localStorage.setItem('hinaConnectorEnabled', previous);
        if (previousTransport === null) localStorage.removeItem('hinaConnectorTransport'); else localStorage.setItem('hinaConnectorTransport', previousTransport);
      }
      return { ok: chunks.some(chunk => chunk.type === 'content' && chunk.text.includes('HINA_CONNECTION_OK')), chunks };
    })()`,
      },
    })
  );
  socket.addEventListener("message", ({ data }) => {
    const response = JSON.parse(data);
    if (response.id !== 1) return;
    if (response.error) {
      console.error("DevTools evaluation failed:", response.error.message);
      process.exitCode = 1;
    } else if (response.result?.exceptionDetails) {
      console.error(
        "Packaged integration failed:",
        response.result.exceptionDetails.exception?.description ||
          response.result.exceptionDetails.text
      );
      process.exitCode = 1;
    } else {
      const value = response.result?.result?.value;
      console.log(JSON.stringify(value));
      if (!value?.ok) process.exitCode = 1;
    }
    socket.close();
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
