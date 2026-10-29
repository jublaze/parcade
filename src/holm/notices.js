export function placementNoticeText(state) {
  const messages = [];
  if (state.barbarianUnavailable) messages.push('No free cell for the barbarian; it is unavailable.');
  if (state.trapPlacementShortage > 0) messages.push(`${state.trapPlacementShortage} extra trap(s) could not be placed because the board is full.`);
  if (state.foodPlacementShortage > 0) messages.push(`${state.foodPlacementShortage} food placement(s) skipped because no cell was free.`);
  return messages.join(' ');
}

export function renderPlacementNotice(state, desktopTarget, mobileTarget) {
  const message = placementNoticeText(state);
  desktopTarget.textContent = message;
  mobileTarget.textContent = message;
  return message;
}
