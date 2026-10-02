import { API_URL } from "./config";

export async function authRequest(mode, username, password) {
  let res;
  try {
    res = await fetch(`${API_URL}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error("Could not reach the server. It may be waking up, try again in a few seconds.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let detail = data.detail;
    if (Array.isArray(detail)) {
      detail = "Username: 3-30 letters, numbers or underscores. Password: 6-72 characters.";
    }
    throw new Error(detail || "Something went wrong");
  }
  return data;   // { token, username }
}