let _onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(fn: (() => void) | null): void {
  _onUnauthorized = fn;
}

export function triggerUnauthorized(): void {
  _onUnauthorized?.();
}
