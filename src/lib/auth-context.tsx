import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  revokedError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

const ADMIN_EMAIL = "camed@fu.do";

async function checkRevoked(email: string): Promise<boolean> {
  if (email === ADMIN_EMAIL) return false;
  try {
    const { data } = await (supabase as any)
      .from("access_requests")
      .select("status")
      .eq("email", email)
      .maybeSingle();
    return data?.status === "revoked";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [loading, setLoading]           = useState(true);
  const [revokedError, setRevokedError] = useState(false);

  useEffect(() => {
    // Listener sincrónico — el check de revocado se dispara aparte
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s?.user) {
        setSession(null);
        setUser(null);
        return;
      }
      // Check revocado sin bloquear el listener
      checkRevoked(s.user.email ?? "").then(revoked => {
        if (revoked) {
          setRevokedError(true);
          supabase.auth.signOut();
        } else {
          setRevokedError(false);
          setSession(s);
          setUser(s.user);
        }
      });
    });

    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (!s?.user) {
        setLoading(false);
        return;
      }
      checkRevoked(s.user.email ?? "").then(revoked => {
        if (revoked) {
          setRevokedError(true);
          supabase.auth.signOut();
        } else {
          setSession(s);
          setUser(s.user);
        }
        setLoading(false);
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user,
    session,
    loading,
    revokedError,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
