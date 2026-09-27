export type RuntimeState = { paused: boolean; repeatedMessages: Map<string, number>; alertKeys: Set<string> };

export function createRuntimeState(): RuntimeState {
  return { paused: false, repeatedMessages: new Map(), alertKeys: new Set() };
}

export function incrementMessage(state: RuntimeState, senderId: number, text: string): number {
  const key = `${senderId}:${text}`;
  const next = (state.repeatedMessages.get(key) ?? 0) + 1;
  state.repeatedMessages.set(key, next);
  return next - 1;
}

export function rememberAlert(state: RuntimeState, chatId: number, messageId: number): boolean {
  const key = `${chatId}:${messageId}`;
  if (state.alertKeys.has(key)) return false;
  state.alertKeys.add(key);
  return true;
}
