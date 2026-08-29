"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authApi } from "@/lib/api/auth/authApi";
import { LoginShell, loginSubmitButtonClass } from "@/components/auth/LoginShell";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await authApi.forgotPassword(email.trim());
      setStep("reset");
      showToast("Email verified. Set your new password.", "success");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr.response?.data?.message || "No account found with this email";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await authApi.resetPassword(email.trim(), newPassword);
      setStep("done");
      showToast("Password reset successful", "success");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const message = axiosErr.response?.data?.message || "Failed to reset password";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "done") {
    return (
      <LoginShell subtitle="Your password has been updated">
        <div className="space-y-4 text-center">
          <p className="text-sm text-zinc-600">
            You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </LoginShell>
    );
  }

  return (
    <LoginShell
      subtitle={
        step === "email"
          ? "Enter your email to reset your password"
          : "Create a new password for your account"
      }
      error={error}
    >
      {step === "email" ? (
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="reset-email" className="text-sm font-medium text-zinc-700">
              Email Address
            </label>
            <div className="group relative">
              <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                autoComplete="email"
                disabled={isLoading}
                className="auth-input"
                required
              />
            </div>
          </div>

          <Button type="submit" className={loginSubmitButtonClass(isLoading)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center">
            <Link href="/login" className="text-sm font-semibold text-primary hover:text-primary/80">
              Back to Sign In
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-zinc-700">
              New Password
            </label>
            <div className="group relative">
              <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                className="auth-input"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-zinc-700">
              Confirm Password
            </label>
            <div className="group relative">
              <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                className="auth-input"
                required
              />
            </div>
          </div>

          <Button type="submit" className={loginSubmitButtonClass(isLoading)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="text-sm font-semibold text-primary hover:text-primary/80"
            >
              Back
            </button>
          </p>
        </form>
      )}
    </LoginShell>
  );
}
