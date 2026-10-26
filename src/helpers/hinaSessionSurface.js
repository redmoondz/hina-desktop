export function sessionSurfaceTransition(state, action) {
  if (action === "close") return { activeId: null, visible: false };
  if (action === "minimize") return { ...state, visible: false };
  return { ...state, visible: true };
}
