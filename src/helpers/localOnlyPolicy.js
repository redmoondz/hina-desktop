const { BYOK_API_KEYS } = require("../config/secretKeys");

const providerKeyChannels = new Set(
  // This legacy setting stores the local Hina Connector bearer token.
  BYOK_API_KEYS.filter(({ base }) => base !== "dictation-agent-custom").flatMap(({ base }) => [
    `get-${base}-key`,
    `save-${base}-key`,
  ])
);
const blockedChannels = new Set([
  "download-diarization-models",
  "get-diarization-model-status",
  "delete-diarization-models",
  "cancel-diarization-download",
  "diarize-audio-file",
  "save-note-speaker-embeddings",
  "request-system-audio-access",
  "check-system-audio-access",
  "permission-guide-verify-system-audio",
  "test-provider-connection",
  "test-enterprise-connection",
  "process-anthropic-reasoning",
  "process-enterprise-reasoning",
  "transcribe-audio-file-cloud",
  "transcribe-audio-file-byok",
  "managed-transcribe",
  "get-stt-config",
  "get-note-recording-config",
  "get-workspace-policy",
  "get-managed-enterprise-config",
  "clear-managed-enterprise-identity",
  "agent-web-search",
  "get-referral-stats",
  "send-referral-invite",
  "get-referral-invites",
  "download-url-audio",
  "check-for-updates",
  "download-update",
  "install-update",
  "set-auto-updates-enabled",
  "get-oauth-protocol",
  "get-oauth-protocol-registered",
  "register-meeting-hotkey",
  "update-translation-hotkey",
  "start-manual-meeting",
  "join-calendar-meeting",
  "set-active-account-scope",
  "delete-account-data",
]);
const blockedPrefixes = [
  "cloud-",
  "auth-",
  "proxy-",
  "enterprise-",
  "activation-",
  "dictation-realtime-",
  "assemblyai-streaming-",
  "deepgram-streaming-",
  "gemini-streaming-",
  "corti-streaming-",
  "meeting-",
  "calendar-",
  "gcal-",
  "mcal-",
  "acal-",
  "connector-",
  "product-help-",
];

function isBlockedLocalOnlyChannel(channel) {
  return (
    blockedChannels.has(channel) ||
    providerKeyChannels.has(channel) ||
    blockedPrefixes.some((prefix) => channel.startsWith(prefix)) ||
    /^(?:get|save)-(?:bedrock|azure|vertex|corti|tinfoil|custom-transcription|cleanup-custom)-/.test(
      channel
    ) ||
    channel === "bedrock-list-models"
  );
}

function localOnlyFailure() {
  return {
    success: false,
    ok: false,
    code: "LOCAL_ONLY",
    error: "This feature is unavailable in the local desktop application.",
  };
}

// Guard registration itself so retained legacy handlers cannot run even when a
// stale renderer or an IPC caller requests a removed cloud feature directly.
function createLocalOnlyIpc(ipcMain) {
  return new Proxy(ipcMain, {
    get(target, property) {
      if (property === "handle" || property === "on") {
        return (channel, handler) =>
          target[property](
            channel,
            isBlockedLocalOnlyChannel(channel)
              ? property === "handle"
                ? localOnlyFailure
                : () => {}
              : handler
          );
      }
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function shouldStartInTray(argv) {
  return !argv.includes("--settings");
}

module.exports = {
  isBlockedLocalOnlyChannel,
  createLocalOnlyIpc,
  shouldStartInTray,
  localOnlyFailure,
};
