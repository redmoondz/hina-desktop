// Main-process transport: packaged file:// renderers cannot use Connector CORS.
function connectorBase(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/v1", "/v1/"].includes(url.pathname)
  )
    throw new Error("Use a loopback Connector URL, for example http://127.0.0.1:3210");
  return url.origin;
}

async function hinaRequest(args, fetcher = fetch) {
  let phase = "address";
  try {
    if (args?.transport === "wsl") {
      if (process.platform !== "win32")
        return { ok: false, error: "WSL transport is available on Windows only" };
      fetcher = wslFetch;
    }
    const base = connectorBase(args?.url);
    if (typeof args.token !== "string" || !args.token || /\s/.test(args.token)) {
      return { ok: false, error: "Enter the Connector bearer token" };
    }
    const options = {
      headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(args.check === true ? 10000 : 120000),
      redirect: "error",
    };
    if (args.check === true) {
      phase = "health";
      const health = await fetcher(`${base}/health`, options);
      const identity = health.ok ? await health.json().catch(() => null) : null;
      if (identity?.agent !== "hina") {
        return { ok: false, error: "The endpoint is not a Hina Connector" };
      }
      phase = "authentication";
      const auth = await fetcher(`${base}/metrics`, options);
      return auth.ok
        ? { ok: true, reply: "Connected to Hina" }
        : {
            ok: false,
            error: `Check the Connector bearer token (HTTP ${auth.status}). Use CONNECTOR_API_TOKEN from the running Connector, not an OpenClaw gateway token.`,
          };
    }
    if (
      typeof args.text !== "string" ||
      !args.text.trim() ||
      Buffer.byteLength(args.text) > 48000
    ) {
      return { ok: false, error: "Enter a nonempty command under 48 KB" };
    }
    phase = "command";
    const response = await fetcher(`${base}/v1/chat/completions`, {
      ...options,
      method: "POST",
      body: JSON.stringify({
        model: "hina",
        messages: [{ role: "user", content: args.text }],
        stream: false,
      }),
    });
    if (!response.ok)
      return { ok: false, error: `Hina Connector returned HTTP ${response.status}` };
    const reply = (await response.json()).choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim())
      return { ok: false, error: "Hina returned an empty reply" };
    return { ok: true, reply };
  } catch {
    if (phase === "address")
      return {
        ok: false,
        error: "Use a loopback Connector URL, for example http://127.0.0.1:3210",
      };
    return {
      ok: false,
      error:
        phase === "command"
          ? "Hina Connector is unavailable or timed out. Check its URL and service."
          : "Cannot reach Hina Connector. Start its service and check the address. On Windows, choose WSL transport if Connector runs inside WSL; the default distribution must contain curl.",
    };
  }
}

// WSL localhost and Windows localhost are separate on some WSL networking
// modes. curl runs inside the default distribution; secrets travel on stdin.
function wslFetch(url, options) {
  const { execFile } = require("node:child_process");
  return new Promise((resolve, reject) => {
    const child = execFile(
      "wsl.exe",
      [
        "--exec",
        "/usr/bin/curl",
        "--config",
        "-",
        "--silent",
        "--show-error",
        "--max-time",
        "120",
        "--write-out",
        "\\n%{http_code}",
      ],
      { timeout: 125000, signal: options.signal, maxBuffer: 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(new Error("WSL Connector request failed"));
          return;
        }
        const split = stdout.lastIndexOf("\n");
        const status = Number(stdout.slice(split + 1));
        if (status < 100 || status > 599) {
          reject(new Error("Invalid WSL HTTP response"));
          return;
        }
        resolve(new Response(stdout.slice(0, split), { status }));
      }
    );
    const lines = [
      `url = ${JSON.stringify(url)}`,
      `request = ${JSON.stringify(options.method || "GET")}`,
    ];
    for (const [key, value] of Object.entries(options.headers))
      lines.push(`header = ${JSON.stringify(`${key}: ${value}`)}`);
    if (options.body) lines.push(`data = ${JSON.stringify(options.body)}`);
    child.stdin.on("error", () => {});
    child.stdin.end(lines.join("\n") + "\n");
  });
}

module.exports = { connectorBase, hinaRequest, wslFetch };
