const fs = require("node:fs");
const path = require("node:path");
const { spawn: systemSpawn } = require("node:child_process");

const LANGUAGES = [
  "ru",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "pl",
  "tr",
  "nl",
  "cs",
  "ar",
  "zh-cn",
  "hu",
  "ko",
  "ja",
  "hi",
];
function createHinaXtts({ root, scripts, platform = process.platform, spawn = systemSpawn }) {
  let worker = null;
  let pending = null;
  let installation = null;
  let installError = "";
  const python = path.join(
    root,
    "runtime",
    platform === "win32" ? "Scripts/python.exe" : "bin/python"
  );
  const ready = () => {
    try {
      return (
        JSON.parse(fs.readFileSync(path.join(root, "installed.json"), "utf8")).version === 1 &&
        fs.existsSync(python) &&
        ["config.json", "model.pth", "vocab.json", "speakers_xtts.pth"].every((name) =>
          fs.existsSync(
            path.join(
              root,
              "models",
              "tts",
              "tts_models--multilingual--multi-dataset--xtts_v2",
              name
            )
          )
        )
      );
    } catch {
      return false;
    }
  };
  const terminate = () => {
    const child = worker;
    worker = null;
    const request = pending;
    pending = null;
    if (request) {
      clearTimeout(request.timer);
      request.resolve({ ok: true, stopped: true });
    }
    child?.kill();
    return { ok: true };
  };
  function request(args) {
    if (installation)
      return Promise.resolve({ ok: false, error: "XTTS installation is still running." });
    if (!ready())
      return Promise.resolve({
        ok: false,
        error: installError || "Install XTTS v2 in Speech settings first.",
      });
    if (pending)
      return Promise.resolve({ ok: false, error: "XTTS is busy. Stop the current speech first." });
    if (!worker) {
      const child = spawn(
        python,
        ["-X", "utf8", "-u", path.join(scripts, "worker.py"), "--root", root],
        {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            HF_HUB_OFFLINE: "1",
            TRANSFORMERS_OFFLINE: "1",
            HF_HUB_DISABLE_TELEMETRY: "1",
            DO_NOT_TRACK: "1",
          },
        }
      );
      worker = child;
      child.stdout.setEncoding?.("utf8");
      let output = "";
      let diagnostic = "";
      const fail = (error) => {
        if (worker !== child) return;
        worker = null;
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve({ ok: false, error: String(error).slice(-1500) });
          pending = null;
        }
        child.kill();
      };
      child.stdout.on("data", (chunk) => {
        if (worker !== child) return;
        output += chunk.toString("utf8");
        if (output.length > 40 * 1024 * 1024) {
          fail("XTTS audio exceeded the size limit.");
          return;
        }
        const end = output.indexOf("\n");
        if (end < 0) return;
        try {
          const result = JSON.parse(output.slice(0, end));
          output = output.slice(end + 1);
          if (pending) {
            clearTimeout(pending.timer);
            pending.resolve(result);
            pending = null;
          }
        } catch {
          fail("XTTS returned an invalid response.");
        }
      });
      child.stderr.on("data", (chunk) => {
        diagnostic = (diagnostic + chunk).slice(-1500);
      });
      child.on("error", (error) => fail(error.message));
      child.on("exit", () => fail(diagnostic || "XTTS worker exited unexpectedly."));
      child.stdin.on("error", (error) => fail(error.message));
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const current = pending;
        pending = null;
        terminate();
        current?.resolve({ ok: false, error: "XTTS timed out. Try a shorter reply or CUDA." });
      }, 600000);
      pending = { resolve, timer };
      worker.stdin.write(JSON.stringify(args) + "\n");
    });
  }
  return {
    status: () => ({
      ok: true,
      installed: ready(),
      installing: Boolean(installation),
      error: installError,
    }),
    install: (options = {}) => {
      if (!options || typeof options !== "object" || Array.isArray(options))
        return { ok: false, error: "Invalid XTTS installation options." };
      const { acceptLicense, device = "cpu", pythonPath } = options;
      if (
        pythonPath !== undefined &&
        (typeof pythonPath !== "string" ||
          pythonPath.length > 4096 ||
          pythonPath.includes("\0") ||
          !path.isAbsolute(pythonPath))
      )
        return { ok: false, error: "Select an absolute Python executable path." };
      if (acceptLicense !== true)
        return { ok: false, error: "Accept the XTTS model license before downloading." };
      if (!["cpu", "cuda"].includes(device)) return { ok: false, error: "Invalid XTTS device." };
      if (installation) return { ok: false, error: "XTTS installation is already running." };
      terminate();
      fs.mkdirSync(root, { recursive: true });
      fs.rmSync(path.join(root, "installed.json"), { force: true });
      installError = "";
      const executable = pythonPath || (platform === "win32" ? "py" : "python3");
      const args = [
        ...(!pythonPath && platform === "win32" ? ["-3.11"] : []),
        "-X",
        "utf8",
        path.join(scripts, "setup.py"),
        "--root",
        root,
        "--device",
        device,
        "--accept-license",
      ];
      const child = spawn(executable, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        detached: platform !== "win32",
      });
      installation = child;
      let log = "";
      const capture = (chunk) => {
        log = (log + chunk).slice(-3000);
      };
      child.stdout.on("data", capture);
      child.stderr.on("data", capture);
      child.on("error", (error) => {
        installError = `Python could not start: ${error.message}. Install Python 3.10–3.12 or select its executable.`;
        installation = null;
      });
      child.on("exit", (code) => {
        if (installation !== child) return;
        installation = null;
        if (code !== 0) installError = log || "XTTS installation failed.";
      });
      return { ok: true, installing: true };
    },
    list: (device = "cpu") => request({ action: "status", device }),
    speak: (args) => {
      const language = typeof args?.language === "string" ? args.language.toLowerCase() : "";
      if (
        typeof args?.text !== "string" ||
        !args.text.trim() ||
        args.text.length > 12000 ||
        typeof language !== "string" ||
        !LANGUAGES.includes(language.startsWith("zh") ? "zh-cn" : language.split("-")[0]) ||
        (args.voice !== undefined && (typeof args.voice !== "string" || args.voice.length > 512)) ||
        (args.reference !== undefined &&
          (typeof args.reference !== "string" ||
            args.reference.length > 4096 ||
            (args.reference && path.extname(args.reference).toLowerCase() !== ".wav"))) ||
        (args.device !== undefined && !["cpu", "cuda"].includes(args.device)) ||
        (args.speed !== undefined &&
          (typeof args.speed !== "number" ||
            !Number.isFinite(args.speed) ||
            args.speed < 0.5 ||
            args.speed > 2)) ||
        (args.temperature !== undefined &&
          (typeof args.temperature !== "number" ||
            !Number.isFinite(args.temperature) ||
            args.temperature < 0.1 ||
            args.temperature > 1))
      )
        return Promise.resolve({ ok: false, error: "Invalid XTTS speech settings." });
      if (pending) terminate();
      return request({
        action: "speak",
        text: args.text,
        language,
        voice: args.voice,
        reference: args.reference,
        device: args.device || "cpu",
        speed: args.speed ?? 1,
        temperature: args.temperature ?? 0.65,
      });
    },
    stop: terminate,
    dispose: () => {
      terminate();
      const child = installation;
      installation = null;
      if (!child) return;
      if (platform === "win32" && Number.isInteger(child.pid)) {
        const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.on("error", () => child.kill());
      } else if (Number.isInteger(child.pid)) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill();
        }
      } else child.kill();
    },
  };
}
module.exports = { createHinaXtts, LANGUAGES };
