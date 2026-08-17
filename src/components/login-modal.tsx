/**
 * Login modal with phone+OTP, Google OAuth, and email+OTP.
 * After auth, checks user.profileComplete:
 * - false → navigate to /complete-profile
 * - true → close modal and resume pendingAction
 */
import { Check, Loader2, Mail, Phone, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type UserRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMethod = "phone" | "google" | "email";
type Step = "method" | "otp";

// ─── Role Toggle ──────────────────────────────────────────────────────────────

function RoleToggle({ role, onChange }: { role: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div className="flex rounded-xl border border-border bg-background p-1" role="group">
      {(["worker", "employer"] as UserRole[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={role === r}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200",
            role === r ? "bg-primary text-primary-foreground shadow-brand" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r === "worker" ? "I'm a Worker" : "I'm an Employer"}
        </button>
      ))}
    </div>
  );
}

// ─── Google Button ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function LoginModal() {
  const {
    loginModalOpen,
    closeLoginModal,
    pendingAction,
    loginWithPhone,
    loginWithGoogle,
    loginWithEmail,
    sendPhoneOTP,
    sendEmailOTP,
  } = useAuth();

  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<AuthMethod | null>(null);
  const [role, setRole] = useState<UserRole>("worker");

  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (loginModalOpen) {
      setStep("method");
      setMethod(null);
      setPhoneInput("");
      setEmailInput("");
      setOtpInput("");
      setOtpSent(false);
      setError(null);
      setLoading(false);
    }
  }, [loginModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!loginModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLoginModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) return null;

  const pendingLabel: Record<string, string> = {
    "book-shift": "Log in to book this shift",
    "post-shift": "Log in to post a shift",
    message: "Log in to send a message",
    dashboard: "Log in to access your dashboard",
  };

  const headline = pendingAction && pendingLabel[pendingAction.type] ? pendingLabel[pendingAction.type] : "Welcome to QuickWork";

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async function handleSendOTP() {
    setError(null);
    setLoading(true);
    try {
      if (method === "phone") {
        if (!phoneInput || phoneInput.length < 10) {
          setError("Please enter a valid phone number.");
          setLoading(false);
          return;
        }
        await sendPhoneOTP(phoneInput);
        setOtpSent(true);
        setStep("otp");
      } else if (method === "email") {
        if (!emailInput || !emailInput.includes("@")) {
          setError("Please enter a valid email address.");
          setLoading(false);
          return;
        }
        await sendEmailOTP(emailInput);
        setOtpSent(true);
        setStep("otp");
      }
    } catch {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP & complete auth ────────────────────────────────────────────
  async function handleVerifyOTP() {
    setError(null);
    setLoading(true);
    try {
      let user;
      if (method === "phone") {
        user = await loginWithPhone(phoneInput, otpInput, role);
      } else if (method === "email") {
        user = await loginWithEmail(emailInput, otpInput, role);
      }
      if (user) {
        // Modal closes automatically inside loginWith* functions
        if (!user.profileComplete) {
          navigate({ to: "/complete-profile" });
        }
        // else: modal closed, pendingAction will be consumed by the caller
      }
    } catch {
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle(role);
      if (!user.profileComplete) {
        navigate({ to: "/complete-profile" });
      }
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-rise"
        aria-hidden="true"
        onClick={closeLoginModal}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 animate-bounce-in rounded-3xl border border-border bg-card p-8 shadow-lift sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
            <Zap className="size-5 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">QuickWork</span>
        </div>

        <h2 id="login-modal-title" className="mt-5 font-display text-2xl font-bold">
          {headline}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "method" ? "Choose how you'd like to continue." : "Enter the OTP we sent you."}
        </p>

        {/* Role toggle */}
        <div className="mt-6">
          <RoleToggle role={role} onChange={setRole} />
        </div>

        {/* Step: Method selection */}
        {step === "method" && (
          <div className="mt-6 space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={() => {
                setMethod("phone");
                setStep("otp");
              }}
            >
              <Phone className="size-5 text-primary" />
              Continue with Phone
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={handleGoogle}
              disabled={loading}
            >
              {loading && method === null ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={() => {
                setMethod("email");
                setStep("otp");
              }}
            >
              <Mail className="size-5 text-primary" />
              Continue with Email
            </Button>
          </div>
        )}

        {/* Step: OTP entry */}
        {step === "otp" && method && (
          <div className="mt-6 space-y-4">
            {!otpSent ? (
              <>
                {/* Phone or Email input */}
                <div className="grid gap-1.5">
                  <Label htmlFor="auth-input">
                    {method === "phone" ? "Phone number" : "Email address"}
                  </Label>
                  <div className="relative">
                    {method === "phone" ? (
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    ) : (
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                    <Input
                      id="auth-input"
                      type={method === "phone" ? "tel" : "email"}
                      placeholder={method === "phone" ? "+91 98765 43210" : "you@example.com"}
                      className="pl-9"
                      value={method === "phone" ? phoneInput : emailInput}
                      onChange={(e) => (method === "phone" ? setPhoneInput(e.target.value) : setEmailInput(e.target.value))}
                    />
                  </div>
                </div>

                <Button variant="hero" size="lg" className="w-full" onClick={handleSendOTP} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Sending OTP…
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* OTP input */}
                <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-success">
                    <Check className="size-4" />
                    OTP sent to {method === "phone" ? phoneInput : emailInput}
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="otp-input">Enter 6-digit OTP</Label>
                  <Input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className="text-center text-lg tracking-widest"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <Button variant="hero" size="lg" className="w-full" onClick={handleVerifyOTP} disabled={loading || otpInput.length !== 6}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpInput("");
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-primary hover:underline"
                >
                  Didn't receive OTP? Resend
                </button>
              </>
            )}

            {/* Back button */}
            <button
              type="button"
              onClick={() => {
                setStep("method");
                setMethod(null);
                setOtpSent(false);
                setOtpInput("");
                setError(null);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to options
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={closeLoginModal}
          aria-label="Close login modal"
          className="absolute right-5 top-5 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </>
  );
}
