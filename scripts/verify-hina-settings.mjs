// Browser smoke test for the built renderer with a simulated Electron bridge.
// Install playwright-core separately and set HINA_PLAYWRIGHT_MODULE when needed.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.HINA_PLAYWRIGHT_MODULE || "playwright-core");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "evidence/settings-enhancements");
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const name = new URL(request.url, "http://localhost").pathname;
    const file = path.join(root, "src/dist", name === "/" ? "index.html" : name);
    const types = {
      ".js": "text/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".json": "application/json",
      ".woff2": "font/woff2",
    };
    response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
let browser;
const errors = [];
const results = [];
try {
  browser = await chromium.launch({
    executablePath: process.env.HINA_CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: 960 }, colorScheme: theme });
      page.on("pageerror", (error) => errors.push(error.stack || String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.addInitScript(
        ({ theme }) => {
          for (const [key, value] of Object.entries({
            theme,
            uiLanguage: "en",
            whisperModel: "large-v3-turbo",
            dictationKey: "Control+Super",
            voiceAgentKey: "Control+Alt+H",
          }))
            localStorage.setItem(key, value);
          const api = {
            localOnly: true,
            getPlatform: () => "win32",
            getAppVersion: async () => "0.2.0",
            getDictationKey: async () => "Control+Super",
            getVoiceAgentKey: async () => "Control+Alt+H",
            getActiveDictationKey: async () => "Control+Super",
            getActivationMode: async () => "tap",
            getDictationAgentCustomKey: async () => "",
            getAutoStartEnabled: async () => ({ enabled: false }),
            listWhisperModels: async () => ({
              success: true,
              models: [{ model: "large-v3-turbo", downloaded: true, size_mb: 1620 }],
            }),
            modelGetAll: async () => [],
            getCudaWhisperStatus: async () => ({
              downloaded: true,
              downloading: false,
              gpuFailed: false,
              needsUpdate: false,
              gpuInfo: {
                hasNvidiaGpu: true,
                cudaSupported: true,
                gpuName: "NVIDIA GeForce RTX 4070",
                driverVersion: "Test driver",
                vramMb: 12288,
              },
            }),
            getVulkanWhisperStatus: async () => ({
              downloaded: false,
              downloading: false,
              vulkan: { available: false },
            }),
            whisperServerStatus: async () => ({
              running: true,
              gpuAccelerated: true,
              gpuBackend: "cuda",
            }),
            getAnalyticsSummary: async () => ({
              totalWords: 5432,
              totalDictations: 42,
              averageWpm: 138,
              wpmCoveragePercent: 100,
              currentStreakDays: 3,
              longestStreakDays: 6,
              totalSpokenDurationMs: 2361739,
              daily: [
                {
                  date: new Date().toISOString().slice(0, 10),
                  words: 5432,
                  dictations: 42,
                  spokenDurationMs: 2361739,
                },
              ],
            }),
            getWhisperDownloadState: async () => ({}),
            takeGpuPackMigrationNotice: async () => null,
            hinaConnectorRequest: async () => ({ ok: true }),
            openExternal: async () => ({ success: true }),
          };
          window.electronAPI = new Proxy(api, {
            get(target, key) {
              if (key in target) return target[key];
              if (String(key).startsWith("on")) return () => () => {};
              return async () => ({ success: true });
            },
          });
          navigator.mediaDevices.enumerateDevices = async () => [
            { kind: "audioinput", deviceId: "default", label: "System microphone" },
          ];
        },
        { theme }
      );
      await page.goto(`http://127.0.0.1:${server.address().port}/?panel=true`);
      await page.getByRole("heading", { name: "Portable settings" }).waitFor();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) errors.push(`Page overflow at ${width}/${theme}`);
      await page.screenshot({ path: path.join(output, `${width}-${theme}-top.png`) });
      for (const [section, heading] of [
        ["gpu", "GPU acceleration"],
        ["stats", "Your Usage"],
        ["preferences", "Portable settings"],
      ]) {
        await page.getByRole("heading", { name: heading, exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `${width}-${theme}-${section}.png`) });
      }
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export JSON" }).click();
      const file = JSON.parse(await readFile(await (await downloaded).path(), "utf8"));
      if (file.version !== 1 || "dictationAgentCustomApiKey" in file.settings)
        throw new Error("Invalid exported preferences");
      const input = page.getByLabel("Import JSON settings");
      await input.setInputFiles({
        name: "hina-settings.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "hina-desktop",
            version: 1,
            settings: { pauseMediaOnDictation: true, keepTranscriptionInClipboard: true, theme },
            connector: { transport: "wsl", controlUrl: "http://127.0.0.1:18789/" },
          })
        ),
      });
      await page.getByRole("status").filter({ hasText: "Settings imported." }).waitFor();
      for (const name of ["Pause media while recording", "Keep transcription in clipboard"]) {
        const toggle = page.getByRole("switch", { name, exact: true });
        if ((await toggle.getAttribute("aria-checked")) !== "true")
          throw new Error(`Import did not update ${name}`);
        await toggle.click();
        if ((await toggle.getAttribute("aria-checked")) !== "false")
          throw new Error(`Toggle did not update ${name}`);
      }
      await input.setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"format":"hina-desktop","version":1,"settings":{"theme":"invalid"}}'),
      });
      await page.getByRole("status").filter({ hasText: "Invalid setting: theme" }).waitFor();
      await page.getByRole("button", { name: "Open OpenClaw Control" }).click();
      await page.getByRole("status").filter({ hasText: "Opened OpenClaw Control" }).waitFor();
      results.push({
        width,
        theme,
        overflow,
        export: true,
        import: true,
        toggles: true,
        invalidImport: true,
        openControl: true,
      });
      await page.close();
    }
  const report = { bridge: "simulated Electron API; real built renderer", results, errors };
  await writeFile(
    path.join(output, "browser-results.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
