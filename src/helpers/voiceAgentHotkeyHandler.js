const { createHotkeyRepeatGate } = require("./hotkeyRepeatGate");

function createVoiceAgentHotkeyHandler({
  windowManager,
  hotkeyManager,
  nativeKeyManager,
  platform = process.platform,
  now = Date.now,
}) {
  const acceptPress = createHotkeyRepeatGate(undefined, now);
  return (key, phase, fromNative = false) => {
    if (["win32", "linux"].includes(platform) && windowManager.getActivationMode() === "push") {
      if (phase === "down") {
        windowManager.startWindowsPushToTalk(
          key || hotkeyManager.getSlotHotkeys("voiceAgent")[0],
          "assistant"
        );
      }
      if (phase === "up") windowManager.handleWindowsPushKeyUp(key);
      return;
    }
    if (phase === "up") return;
    if (!fromNative && platform === "win32" && nativeKeyManager?.isWatchingKey?.(key)) return;
    if (acceptPress()) windowManager.sendToggleVoiceAgent();
  };
}

module.exports = { createVoiceAgentHotkeyHandler };
