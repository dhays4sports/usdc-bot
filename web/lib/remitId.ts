export function newId() {
  // short, URL-safe, good enough for MVV
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}
