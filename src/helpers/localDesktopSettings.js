// The packaged desktop exposes this policy through its immutable preload API.
// Keep model, device, shortcut and Connector credentials outside these defaults.
export const localDesktopSettings = Object.freeze({
  useLocalWhisper: true,
  transcriptionMode: "local",
  localTranscriptionProvider: "whisper",
  allowOpenAIFallback: false,
  allowLocalFallback: false,
  useCleanupModel: false,
  cleanupMode: "local",
  useDictationAgent: true,
  dictationAgentMode: "self-hosted",
  dictationAgentProvider: "custom",
  dictationAgentModel: "hina",
  voiceAgentScreenContext: false,
  useDictationAgentVisionModel: false,
  toneStyleEnabled: false,
  isSignedIn: false,
  autoUpdatesEnabled: false,
  notifyMeetingDetection: false,
  notifyCalendarReminders: false,
  meetingProcessDetection: false,
  customDictionary: [],
  snippets: [],
  translationKey: "",
  meetingKey: "",
});

export function persistLocalDesktopSettings(storage) {
  for (const [key, value] of Object.entries(localDesktopSettings)) {
    storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}
