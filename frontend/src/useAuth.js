import { useCallback, useState } from "react";
import { authRequest } from "./auth";

const KEY = "matinee_auth";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function useAuth() {
  const [saved, setSaved] = useState(load);

  const signIn = useCallback(async (mode, username, password) => {
    const data = await authRequest(mode, username, password);
    const value = { token: data.token, username: data.username };
    localStorage.setItem(KEY, JSON.stringify(value));
    setSaved(value);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    setSaved(null);
  }, []);

  return { token: saved ? saved.token : null, username: saved ? saved.username : null, signIn, signOut };
}