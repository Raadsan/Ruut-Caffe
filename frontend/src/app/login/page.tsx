"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authApi } from "@/lib/api/auth/authApi";
import { APP_SYSTEM_NAME, APP_VERSION } from "@/lib/constants";
import { LoginShell, loginSubmitButtonClass } from "@/components/auth/LoginShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await authApi.login({ email, password });
      showToast("Login successful!", "success");

      const userRole = res?.user?.role?.toLowerCase();
      if (userRole === "pos") {
        window.location.replace("/pos-terminal");
      } else if (["restaurant", "manager"].includes(userRole)) {
        window.location.replace("/restaurant/dashboard");
      } else if (["accounting", "accountant"].includes(userRole)) {
        window.location.replace("/accounting/dashboard");
      } else {
        window.location.replace("/dashboard");
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      const message =
        !axiosErr.response && axiosErr.message === "Network Error"
          ? "Cannot connect to server. Make sure the backend is running on port 7005."
          : axiosErr.response?.data?.message ||
            axiosErr.message ||
            "Failed to login. Please try again.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginShell subtitle="Sign in to manage your restaurant system" error={error}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-zinc-700">
            Email Address
          </label>
          <div className="group relative">
            <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              disabled={isLoading}
              className="auth-input"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Password
          </label>
          <div className="group relative">
            <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              className="auth-input pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 transition-colors hover:text-primary focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className={loginSubmitButtonClass(isLoading)}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <div className="relative flex items-center gap-3 my-1">
          <div className="flex-1 border-t border-zinc-200" />
          <span className="text-[11px] text-zinc-400 font-medium shrink-0">or</span>
          <div className="flex-1 border-t border-zinc-200" />
        </div>

        <button
          type="button"
          onClick={() => router.push("/pos/login")}
          className="flex w-full items-center justify-center gap-2 h-11 rounded-md border-2 border-primary/20 bg-primary/5 text-primary font-semibold text-sm hover:bg-primary/10 hover:border-primary/40 transition-all"
        >
          <MonitorSmartphone className="h-4 w-4" />
          POS Login
        </button>

        <p className="text-center text-xs leading-relaxed text-zinc-400">
          {APP_SYSTEM_NAME}
          <br />
          Version {APP_VERSION}
        </p>
      </form>
    </LoginShell>
  );
}
