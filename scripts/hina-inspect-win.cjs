// Run with Windows Node 24 against the packaged app's local DevTools port.
const fs = require("node:fs");
const path = require("node:path");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  console.log(JSON.stringify(targets.map(({ id, title, url }) => ({ id, title, url }))));
  const target = targets.find((item) => item.url.includes("panel=true"));
  if (!target) throw new Error("No packaged application window");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const result = JSON.parse(data);
    if (result.id) {
      const callbacks = pending.get(result.id);
      pending.delete(result.id);
      if (result.error) callbacks.reject(new Error(JSON.stringify(result.error)));
      else callbacks.resolve(result.result);
    } else if (result.method === "Runtime.exceptionThrown")
      errors.push(result.params.exceptionDetails.text);
    else if (result.method === "Log.entryAdded" && result.params.entry.level === "error")
      errors.push(result.params.entry.text);
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await cdp("Runtime.enable");
  await cdp("Log.enable");
  await cdp("Page.bringToFront");
  await pause(3000);
  console.log("SETTINGS_TEXT", await evaluate("document.body.innerText.slice(0, 3000)"));
  const forbidden = await evaluate(
    "/OpenWhispr|Sign in|Upgrade|Subscription|API keys|MCP servers/i.test(document.body.innerText)"
  );
  if (forbidden) throw new Error("Removed product surface remains visible");
  const output = path.join(process.env.TEMP, "hina-evidence");
  fs.mkdirSync(output, { recursive: true });
  for (const width of [1280, 390]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const theme of ["light", "dark"]) {
      await cdp("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: theme }],
      });
      await evaluate(`document.documentElement.classList.toggle('dark', ${theme === "dark"})`);
      for (const position of ["top", "bottom"]) {
        await evaluate(
          `document.querySelector('main').scrollTop = ${position === "top" ? "0" : "document.querySelector('main').scrollHeight"}`
        );
        await pause(300);
        const overflow = await evaluate(
          "document.querySelector('main').scrollWidth > innerWidth + 1"
        );
        if (overflow) throw new Error("Settings overflow the viewport horizontally");
        const screenshot = await cdp("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        fs.writeFileSync(
          path.join(output, `settings-${width}-${theme}${position === "top" ? "" : "-bottom"}.png`),
          Buffer.from(screenshot.data, "base64")
        );
      }
    }
  }
  await cdp("Emulation.clearDeviceMetricsOverride");
  console.log("CONSOLE_EXCEPTIONS", JSON.stringify(errors));
  console.log("SCREENSHOTS", output);
  socket.close();
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
