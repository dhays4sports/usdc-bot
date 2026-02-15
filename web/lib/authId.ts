export function newAuthId() {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}
