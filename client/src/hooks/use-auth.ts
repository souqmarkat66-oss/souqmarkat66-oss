import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { useState, useCallback } from "react";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [loginLoading, setLoginLoading]     = useState(false);
  const [registerLoading, setRegLoading]    = useState(false);
  const [setPwLoading, setSetPwLoading]     = useState(false);
  const [logoutLoading, setLogoutLoading]   = useState(false);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const login = useCallback(async (data: { identifier: string; password: string }) => {
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw { status: res.status, ...json };
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return json;
    } finally {
      setLoginLoading(false);
    }
  }, [queryClient]);

  const register = useCallback(async (data: {
    firstName: string; lastName?: string;
    email?: string; phone?: string; password: string;
  }) => {
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "فشل التسجيل");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return json;
    } finally {
      setRegLoading(false);
    }
  }, [queryClient]);

  const setPassword = useCallback(async (data: { challengeId: string; resetProof: string; password: string }) => {
    setSetPwLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "فشل تعيين كلمة المرور");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      return json;
    } finally {
      setSetPwLoading(false);
    }
  }, [queryClient]);

  const logout = useCallback(async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/login";
    } finally {
      setLogoutLoading(false);
    }
  }, [queryClient]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: {
      mutateAsync: login,
      isPending: loginLoading,
    },
    register: {
      mutateAsync: register,
      isPending: registerLoading,
    },
    setPassword: {
      mutateAsync: setPassword,
      isPending: setPwLoading,
    },
    logout,
    isLoggingOut: logoutLoading,
  };
}
