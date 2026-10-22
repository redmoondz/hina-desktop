// Run with Windows Node 24 against the packaged app's local DevTools port.
const fs = require("node:fs");
const path = require("node:path");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const targets = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  console.log(JSON.stringify(targets.map(({ id, title, url }) => ({ id, title, url }))));
  const target =
    targets.find((item) => item.url.includes("panel=true")) ||
    targets.find((item) => item.type === "page");
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
  console.log("INITIAL", await evaluate("document.body.innerText.slice(0, 1200)"));
  await evaluate(
    "localStorage.setItem('onboardingCompleted','true'); localStorage.setItem('authenticationSkipped','true'); location.reload()"
  );
  await pause(4000);
  console.log("OPEN_SETTINGS", await evaluate("window.electronAPI.openSettingsSection('llms')"));
  await pause(2000);
  await evaluate(
    "[...document.querySelectorAll('button')].find((button) => /Voice Assistant|Голосовой ассистент/i.test(button.textContent))?.click()"
  );
  await pause(1500);
  console.log("SETTINGS", await evaluate("document.body.innerText.slice(-2500)"));
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
      await pause(300);
      const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(
        path.join(output, `settings-${width}-${theme}.png`),
        Buffer.from(screenshot.data, "base64")
      );
    }
  }
  await cdp("Emulation.clearDeviceMetricsOverride");
  console.log("CONSOLE_EXCEPTIONS", JSON.stringify(errors));
  console.log("SCREENSHOTS", output);
  socket.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
