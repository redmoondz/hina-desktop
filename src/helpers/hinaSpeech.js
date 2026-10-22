const { execFile: systemExecFile } = require("node:child_process");

// The script is fixed. Untrusted answer text and voice names arrive as JSON on
// stdin, never interpolated into PowerShell source or process arguments.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName System.Speech
  $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $voices = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object {
    @{ id = $_.VoiceInfo.Name; name = $_.VoiceInfo.Name; language = $_.VoiceInfo.Culture.Name }
  })
  if ($request.action -eq 'list') {
    @{ ok = $true; voices = $voices } | ConvertTo-Json -Depth 4 -Compress
  } else {
    $voice = $null
    if ($request.voice) {
      $voice = $voices | Where-Object { $_.id -eq $request.voice -and $_.language -eq $request.language } | Select-Object -First 1
    } else {
      $voice = $voices | Where-Object { $_.language -eq $request.language } | Select-Object -First 1
    }
    if (!$voice) { throw 'No installed Windows voice matches the selected language. Install a speech voice in Windows Settings or choose another language.' }
    $synth.SelectVoice($voice.id)
    $synth.Speak([string]$request.text)
    @{ ok = $true } | ConvertTo-Json -Compress
  }
} catch {
  @{ ok = $false; error = 'Windows speech failed. Check that the selected language and voice are installed in Windows Settings.' } | ConvertTo-Json -Compress
} finally {
  if ($synth) { $synth.Dispose() }
}
`;

function createHinaSpeech({ platform = process.platform, execFile = systemExecFile } = {}) {
  let active = null;
  const stop = () => {
    active?.kill();
    active = null;
    return { ok: true };
  };
  const run = (request) => {
    if (platform !== "win32")
      return Promise.resolve({ ok: false, error: "Windows speech is available on Windows only." });
    if (request.action === "speak") stop();
    return new Promise((resolve) => {
      const child = execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(SCRIPT, "utf16le").toString("base64"),
        ],
        {
          windowsHide: true,
          timeout: request.action === "list" ? 15000 : 300000,
          maxBuffer: 1024 * 1024,
          encoding: "utf8",
        },
        (error, stdout) => {
          if (active === child) active = null;
          try {
            resolve(
              error
                ? { ok: false, error: "Windows speech process failed or was stopped." }
                : JSON.parse(stdout.replace(/^\uFEFF/, ""))
            );
          } catch {
            resolve({ ok: false, error: "Invalid response from Windows speech." });
          }
        }
      );
      if (request.action === "speak") active = child;
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(request));
    });
  };
  return {
    list: () => run({ action: "list" }),
    speak: (args) => {
      if (
        typeof args?.text !== "string" ||
        !args.text.trim() ||
        args.text.length > 48000 ||
        typeof args.language !== "string" ||
        !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(args.language) ||
        (args.voice !== undefined && (typeof args.voice !== "string" || args.voice.length > 512))
      )
        return Promise.resolve({ ok: false, error: "Invalid speech text, language or voice." });
      return run({ action: "speak", text: args.text, language: args.language, voice: args.voice });
    },
    stop,
  };
}

module.exports = { createHinaSpeech };
