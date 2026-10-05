// Reads the logged-in user's id from the JWT in localStorage.
// Returns null if there is no token or it can't be read.
export function getUserIdFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).id || null;
  } catch {
    return null;
  }
}