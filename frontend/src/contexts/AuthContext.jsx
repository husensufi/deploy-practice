import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../services/api.js";

const AuthContext = createContext(null);

function isUnauthorized(error) {
  return error?.response?.status === 401;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/auth/me")
      .then((account) => {
        if (!active) return;
        setUser(account);
        setStatus("authenticated");
      })
      .catch((requestError) => {
        if (!active) return;
        if (isUnauthorized(requestError)) {
          setUser(null);
          setStatus("unauthenticated");
        } else {
          setError("Could not check your sign-in status. Please retry.");
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(credentials) {
    setError("");
    const account = await apiRequest("/auth/login", {
      method: "POST",
      data: credentials,
    });
    setUser(account);
    setStatus("authenticated");
  }

  async function register(details) {
    setError("");
    const account = await apiRequest("/auth/register", {
      method: "POST",
      data: details,
    });
    setUser(account);
    setStatus("authenticated");
  }

  async function logout() {
    await apiRequest("/auth/logout", { method: "POST" });
    setUser(null);
    setStatus("unauthenticated");
  }

  function updateUser(account) {
    setUser(account);
  }

  function endSession() {
    setUser(null);
    setStatus("unauthenticated");
  }

  const value = useMemo(
    () => ({ user, status, error, login, register, logout, updateUser, endSession }),
    [user, status, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
