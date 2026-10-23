export function shouldOpenAssistantTextInput({
  isAssistantVoice,
  isRecording,
  isPreparing,
  hasDragged,
}) {
  return Boolean(isAssistantVoice && (isRecording || isPreparing) && !hasDragged);
}

export async function openAssistantTextInput(cancelRecording, openComposer) {
  await cancelRecording();
  await openComposer();
}
