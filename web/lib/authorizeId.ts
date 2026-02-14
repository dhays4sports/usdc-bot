export function newAuthId() {
  // short, URL-friendly
  return Math.random().toString(36).slice(2, 8) + "-" + Date.now().toString(36);
}
