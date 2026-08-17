/**
 * Auth context with phone+OTP, Google, email+OTP support.
 * Tracks user onboarding state: if profileComplete is false after login,
 * the app should redirect to /complete-profile.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "worker" | "employer";

export interface AuthUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  profileComplete: boolean;
  /** Avatar URL or initials */
  avatar?: string;
}

export interface PendingAction {
  type: "book-shift" | "post-shift" | "message" | "dashboard";
  payload?: unknown;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  openLoginModal: (pending?: PendingAction) => void;
  closeLoginModal: () => void;
  loginModalOpen: boolean;
  pendingAction: PendingAction | null;
  clearPendingAction: () => void;
  /** Phone+OTP login. Returns user object on success. */
  loginWithPhone: (phone: string, otp: string, role: UserRole) => Promise<AuthUser>;
  /** Google OAuth login. Returns user object on success. */
  loginWithGoogle: (role: UserRole) => Promise<AuthUser>;
  /** Email+OTP login. Returns user object on success. */
  loginWithEmail: (email: string, otp: string, role: UserRole) => Promise<AuthUser>;
  /** Send OTP to phone. Returns true on success. */
  sendPhoneOTP: (phone: string) => Promise<boolean>;
  /** Send OTP to email. Returns true on success. */
  sendEmailOTP: (email: string) => Promise<boolean>;
  /** Complete user profile after first login. */
  completeProfile: (data: Partial<AuthUser>) => Promise<void>;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const openLoginModal = useCallback((pending?: PendingAction) => {
    if (pending) setPendingAction(pending);
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // ── Mock phone+OTP login ──────────────────────────────────────────────────
  const loginWithPhone = useCallback(async (phone: string, _otp: string, role: UserRole): Promise<AuthUser> => {
    await new Promise((r) => setTimeout(r, 800));
    // Check if user exists (mock: phone ending in "999" = returning user)
    const isReturning = phone.endsWith("999");
    const mockUser: AuthUser = {
      id: `u_phone_${Date.now()}`,
      name: isReturning ? (role === "employer" ? "Saffron Caterers" : "Rahul Mehta") : null,
      phone,
      email: null,
      role,
      profileComplete: isReturning,
      avatar: isReturning ? (role === "employer" ? "SC" : "RM") : undefined,
    };
    setUser(mockUser);
    setLoginModalOpen(false);
    return mockUser;
  }, []);

  // ── Mock Google OAuth ─────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async (role: UserRole): Promise<AuthUser> => {
    await new Promise((r) => setTimeout(r, 1000));
    // Mock: always treat Google as new user needing profile completion
    const mockUser: AuthUser = {
      id: `u_google_${Date.now()}`,
      name: null, // will be filled in profile completion
      phone: null,
      email: "user@gmail.com",
      role,
      profileComplete: false,
    };
    setUser(mockUser);
    setLoginModalOpen(false);
    return mockUser;
  }, []);

  // ── Mock email+OTP login ──────────────────────────────────────────────────
  const loginWithEmail = useCallback(async (email: string, _otp: string, role: UserRole): Promise<AuthUser> => {
    await new Promise((r) => setTimeout(r, 800));
    // Mock: email ending in ".old" = returning user
    const isReturning = email.endsWith(".old");
    const mockUser: AuthUser = {
      id: `u_email_${Date.now()}`,
      name: isReturning ? (role === "employer" ? "Saffron Caterers" : "Rahul Mehta") : null,
      phone: null,
      email,
      role,
      profileComplete: isReturning,
      avatar: isReturning ? (role === "employer" ? "SC" : "RM") : undefined,
    };
    setUser(mockUser);
    setLoginModalOpen(false);
    return mockUser;
  }, []);

  // ── Mock OTP send ─────────────────────────────────────────────────────────
  const sendPhoneOTP = useCallback(async (_phone: string): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }, []);

  const sendEmailOTP = useCallback(async (_email: string): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }, []);

  // ── Complete profile ──────────────────────────────────────────────────────
  const completeProfile = useCallback(async (data: Partial<AuthUser>) => {
    await new Promise((r) => setTimeout(r, 800));
    setUser((prev) => {
      if (!prev) return null;
      const initials = data.name
        ? data.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "U";
      return {
        ...prev,
        ...data,
        profileComplete: true,
        avatar: initials,
      };
    });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setPendingAction(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn: user !== null,
      user,
      openLoginModal,
      closeLoginModal,
      loginModalOpen,
      pendingAction,
      clearPendingAction,
      loginWithPhone,
      loginWithGoogle,
      loginWithEmail,
      sendPhoneOTP,
      sendEmailOTP,
      completeProfile,
      logout,
    }),
    [
      user,
      loginModalOpen,
      pendingAction,
      openLoginModal,
      closeLoginModal,
      clearPendingAction,
      loginWithPhone,
      loginWithGoogle,
      loginWithEmail,
      sendPhoneOTP,
      sendEmailOTP,
      completeProfile,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
