// Local-only packaged runtime verification. No provider API calls or agent turns.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const evidence = { timestamp: new Date().toISOString(), ok: false };
  const output = path.join(process.env.TEMP || os.tmpdir(), "hina-evidence", "smoke.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  let socket;
  let stage = "connect";
  try {
    const targets = await (
      await fetch("http://127.0.0.1:9333/json/list", { signal: AbortSignal.timeout(10000) })
    ).json();
    const target = targets.find((item) => item.type === "page" && item.url.includes("panel=true"));
    assert.ok(
      target,
      "Launch the packaged application with --settings and --remote-debugging-port=9333"
    );
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("DevTools connection timed out")), 10000);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("DevTools connection failed"));
        },
        { once: true }
      );
    });
    let id = 0;
    const pending = new Map();
    socket.addEventListener("message", ({ data }) => {
      const response = JSON.parse(data);
      const request = pending.get(response.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(response.id);
      if (response.error || response.result?.exceptionDetails)
        request.reject(new Error("Runtime verification failed"));
      else request.resolve(response.result?.result?.value);
    });
    function evaluate(expression, timeout = 30000) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error("Runtime verification timed out"));
        }, timeout);
        pending.set(requestId, { resolve, reject, timer });
        socket.send(
          JSON.stringify({
            id: requestId,
            method: "Runtime.evaluate",
            params: { expression, awaitPromise: true, returnByValue: true },
          })
        );
      });
    }

    stage = "local-policy";
    evidence.runtime = await evaluate(`(async () => {
      const api = window.electronAPI;
      const [models, cuda, cloud] = await Promise.all([api.listWhisperModels(), api.getCudaWhisperStatus(), api.managedTranscribe({})]);
      return {
        localOnly: api.localOnly === true,
        selectedModel: localStorage.getItem('whisperModel'),
        models: (models.models || []).filter(model => model.downloaded).map(model => model.model),
        cuda: { downloaded: cuda.downloaded === true, needsUpdate: cuda.needsUpdate === true, inUse: cuda.inUse === true, gpuFailed: cuda.gpuFailed === true },
        cloud: { code: cloud.code, success: cloud.success }
      };
    })()`);
    assert.equal(
      evidence.runtime.localOnly,
      true,
      "Packaged application must enforce local-only mode"
    );
    assert.equal(evidence.runtime.cloud.code, "LOCAL_ONLY", "Cloud IPC must be blocked");
    assert.ok(
      evidence.runtime.models.includes("turbo"),
      "Imported Whisper model must be discovered"
    );
    assert.equal(evidence.runtime.cuda.downloaded, true, "Imported CUDA pack must be discovered");

    stage = "whisper-start";
    evidence.start = await evaluate("window.electronAPI.whisperServerStart('turbo')", 180000);
    assert.equal(evidence.start?.success, true, "Local Whisper server must start");
    evidence.server = await evaluate(`(async () => {
      const status = await window.electronAPI.whisperServerStatus();
      return { running: status.running, isRemote: status.isRemote, gpuAccelerated: status.gpuAccelerated, gpuBackend: status.gpuBackend, model: status.model, modelName: status.modelName };
    })()`);

    assert.equal(evidence.server.running, true, "Local Whisper server must be running");
    assert.equal(evidence.server.isRemote, false, "Whisper must run on this computer");

    const audioFile = process.argv[2];
    if (audioFile) {
      stage = "local-transcription";
      const bytes = fs.readFileSync(audioFile);
      assert.ok(bytes.length > 44, "Audio fixture must contain samples");
      const base64 = bytes.toString("base64");
      evidence.transcription = await evaluate(
        `(async () => {
        const raw = atob(${JSON.stringify(base64)});
        const audio = Uint8Array.from(raw, character => character.charCodeAt(0)).buffer;
        const result = await window.electronAPI.transcribeLocalWhisper(audio, { model: 'turbo', language: 'en', skipVad: true });
        return { success: result.success, text: result.text || '' };
      })()`,
        180000
      );
      assert.equal(evidence.transcription.success, true, "Local transcription must succeed");
      assert.ok(evidence.transcription.text.trim(), "Local transcription must return text");
    } else {
      evidence.transcription = { skipped: true, reason: "No WAV fixture supplied" };
    }

    stage = "connector-health";
    evidence.connector = await evaluate(
      `(async () => {
      if (localStorage.getItem('hinaConnectorEnabled') !== 'true') return { checked: false, ok: false };
      try {
        const token = await window.electronAPI.getDictationAgentCustomKey();
        const result = await window.electronAPI.hinaConnectorRequest({
          url: localStorage.getItem('dictationAgentRemoteUrl') || 'http://127.0.0.1:3210',
          transport: localStorage.getItem('hinaConnectorTransport') === 'wsl' ? 'wsl' : 'local',
          token: token || '', check: true
        });
        return { checked: true, ok: result.ok === true };
      } catch { return { checked: true, ok: false }; }
    })()`,
      130000
    );
    if (evidence.connector.checked)
      assert.equal(evidence.connector.ok, true, "Configured connector health check must succeed");
    evidence.ok = true;
  } catch (error) {
    evidence.failure = {
      stage,
      message:
        error instanceof assert.AssertionError
          ? error.message
          : "Local runtime verification failed",
    };
    process.exitCode = 1;
  } finally {
    socket?.close();
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
    console.log(JSON.stringify({ ...evidence, evidenceFile: output }, null, 2));
  }
}

main().catch(() => {
  console.error("Local smoke verification failed before evidence was initialized");
  process.exitCode = 1;
});
