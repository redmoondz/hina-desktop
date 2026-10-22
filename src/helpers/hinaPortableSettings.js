// An explicit allowlist keeps credentials, account state and machine paths out
// of portable preferences, even when new settings are added to the store.
const strings = [
  "whisperModel",
  "preferredLanguage",
  "uiLanguage",
  "dictationKey",
  "voiceAgentKey",
  "selectedMicDeviceId",
  "selectedMicDeviceLabel",
];
const booleans = [
  "pauseMediaOnDictation",
  "keepTranscriptionInClipboard",
  "audioCuesEnabled",
  "autoPasteEnabled",
  "showTranscriptionPreview",
  "keepLocalModelLoaded",
  "startMinimized",
];
const enums = {
  theme: ["auto", "light", "dark"],
  activationMode: ["tap", "push"],
  microphoneSelectionMode: ["system", "built-in", "specific"],
};
const keys = [
  ...strings,
  ...booleans,
  ...Object.keys(enums),
  "micWarmHoldSeconds",
  "dictationAgentRemoteUrl",
];

export function controlPanelUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use an HTTP or HTTPS dashboard address without credentials, query or fragment."
    );
  }
  return url.href;
}

function validateSettings(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    throw new Error("Invalid settings object.");
  for (const [key, value] of Object.entries(settings)) {
    if (!keys.includes(key)) throw new Error(`Unsupported setting: ${key}`);
    if (strings.includes(key) && (typeof value !== "string" || value.length > 512))
      throw new Error(`Invalid setting: ${key}`);
    if (booleans.includes(key) && typeof value !== "boolean")
      throw new Error(`Invalid setting: ${key}`);
    if (Object.hasOwn(enums, key) && !enums[key].includes(value))
      throw new Error(`Invalid setting: ${key}`);
    if (key === "micWarmHoldSeconds" && ![0, 10, 60, 900].includes(value))
      throw new Error("Invalid microphone hold duration.");
    if (key === "dictationAgentRemoteUrl") {
      const url = new URL(value);
      if (
        url.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !["/", "/v1", "/v1/"].includes(url.pathname)
      ) {
        throw new Error("Use a loopback Hina Connector address.");
      }
    }
  }
}

export function exportSettings(state, connector = {}, speech = {}) {
  const settings = Object.fromEntries(
    keys.filter((key) => state[key] !== undefined).map((key) => [key, state[key]])
  );
  const portableConnector = Object.fromEntries(
    ["url", "transport", "controlUrl", "timeoutSeconds"]
      .filter((key) => connector[key] !== undefined)
      .map((key) => [key, connector[key]])
  );
  return parseSettings(
    JSON.stringify({
      format: "hina-desktop",
      version: 1,
      settings,
      connector: portableConnector,
      speech,
    })
  );
}

export function parseSettings(text) {
  if (text.length > 65536) throw new Error("Settings file exceeds 64 KB.");
  const file = JSON.parse(text);
  if (file?.format !== "hina-desktop" || file.version !== 1)
    throw new Error("Unsupported Hina settings format or version.");
  if (
    Object.keys(file).some(
      (key) => !["format", "version", "settings", "connector", "speech"].includes(key)
    )
  )
    throw new Error("Unsupported settings file field.");
  validateSettings(file.settings);
  const connector = file.connector ?? {};
  if (
    !connector ||
    typeof connector !== "object" ||
    Array.isArray(connector) ||
    Object.keys(connector).some(
      (key) => !["url", "token", "transport", "controlUrl", "timeoutSeconds"].includes(key)
    )
  )
    throw new Error("Invalid Connector preferences.");
  if (connector.transport !== undefined && !["local", "wsl"].includes(connector.transport))
    throw new Error("Invalid Connector transport.");
  if (connector.controlUrl !== undefined) controlPanelUrl(connector.controlUrl);
  if (
    connector.timeoutSeconds !== undefined &&
    (!Number.isInteger(connector.timeoutSeconds) ||
      connector.timeoutSeconds < 1 ||
      connector.timeoutSeconds > 3600)
  )
    throw new Error("Choose an agent timeout between 1 and 3600 seconds.");
  if (connector.url !== undefined) validateSettings({ dictationAgentRemoteUrl: connector.url });
  if (
    connector.token !== undefined &&
    (typeof connector.token !== "string" ||
      !connector.token ||
      /\s/.test(connector.token) ||
      connector.token.length > 4096)
  )
    throw new Error("Invalid Connector bearer token.");
  if (
    connector.url &&
    file.settings.dictationAgentRemoteUrl &&
    connector.url !== file.settings.dictationAgentRemoteUrl
  )
    throw new Error("Connector addresses must match.");
  const speech = file.speech ?? {};
  if (
    !speech ||
    typeof speech !== "object" ||
    Array.isArray(speech) ||
    Object.keys(speech).some((key) => !["enabled", "language", "voice"].includes(key)) ||
    (speech.enabled !== undefined && typeof speech.enabled !== "boolean") ||
    (speech.language !== undefined &&
      (typeof speech.language !== "string" ||
        !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(speech.language))) ||
    (speech.voice !== undefined && (typeof speech.voice !== "string" || speech.voice.length > 512))
  )
    throw new Error("Invalid speech preferences.");
  return { format: "hina-desktop", version: 1, settings: file.settings, connector, speech };
}

export async function checkConnection({ url, token, transport }, api) {
  const key = token || (await api.getDictationAgentCustomKey?.()) || "";
  const result = await api.hinaConnectorRequest({ url, token: key, transport, check: true });
  if (!result.ok) throw new Error(result.error || "Cannot connect to Hina.");
  return key;
}

export async function saveConnection({ url, token, transport }, store, storage, api) {
  const saved = await api.saveDictationAgentCustomKey(token);
  if (saved?.success === false) throw new Error("Could not save Connector credentials.");
  store.setDictationAgentCustomApiKey(token);
  enableConnection({ url, transport }, store, storage);
}

export function enableConnection({ url, transport }, store, storage) {
  store.setDictationAgentRemoteUrl(url);
  store.setDictationAgentModel("hina");
  store.setDictationAgentMode("self-hosted");
  store.setUseDictationAgent(true);
  storage.setItem("hinaConnectorTransport", transport);
  storage.setItem("hinaConnectorEnabled", "true");
}

export async function applySettings(file, store, storage, api) {
  // Validate the complete document before the first mutation.
  const parsed = parseSettings(JSON.stringify({ format: "hina-desktop", version: 1, ...file }));
  const settings = parsed.settings;
  const shouldConnect = parsed.connector.url !== undefined || parsed.connector.token !== undefined;
  const connection = {
    url:
      parsed.connector.url ||
      settings.dictationAgentRemoteUrl ||
      store.dictationAgentRemoteUrl ||
      "http://127.0.0.1:3210",
    transport: parsed.connector.transport || storage.getItem?.("hinaConnectorTransport") || "local",
    token: parsed.connector.token,
  };
  if (shouldConnect) connection.token = await checkConnection(connection, api);
  const destinationChanged =
    (settings.dictationAgentRemoteUrl !== undefined &&
      settings.dictationAgentRemoteUrl !== store.dictationAgentRemoteUrl) ||
    (parsed.connector.transport !== undefined &&
      parsed.connector.transport !== (storage.getItem?.("hinaConnectorTransport") || "local"));
  // Register the assistant shortcut first: a conflict must not silently replace it.
  if (settings.voiceAgentKey !== undefined) {
    const result = await store.setVoiceAgentKey(settings.voiceAgentKey);
    if (result?.success === false)
      throw new Error(result.message || "Assistant shortcut is unavailable.");
  }
  for (const [key, value] of Object.entries(settings)) {
    if (["voiceAgentKey", "selectedMicDeviceId", "selectedMicDeviceLabel"].includes(key)) continue;
    const setter = store[`set${key[0].toUpperCase()}${key.slice(1)}`];
    await setter(value);
  }
  if (settings.selectedMicDeviceId !== undefined || settings.selectedMicDeviceLabel !== undefined) {
    store.setSelectedMicDevice(
      settings.selectedMicDeviceId ?? store.selectedMicDeviceId,
      settings.selectedMicDeviceLabel ?? store.selectedMicDeviceLabel
    );
  }
  if (parsed.connector.transport)
    storage.setItem("hinaConnectorTransport", parsed.connector.transport);
  if (parsed.connector.controlUrl) storage.setItem("hinaControlUrl", parsed.connector.controlUrl);
  if (destinationChanged && storage.getItem?.("hinaConnectorEnabled") === "true")
    storage.setItem("hinaConnectorEnabled", "false");
  if (shouldConnect) await saveConnection(connection, store, storage, api);
  if (parsed.connector.timeoutSeconds !== undefined)
    storage.setItem("hinaConnectorTimeoutSeconds", String(parsed.connector.timeoutSeconds));
  for (const [key, value] of Object.entries(parsed.speech))
    storage.setItem(`hinaSpeech${key[0].toUpperCase()}${key.slice(1)}`, String(value));
  return { connected: shouldConnect };
}
