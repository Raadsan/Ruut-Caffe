"use client";

import React, { useState, useCallback, useRef } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { authApi } from "@/lib/api/auth/authApi";
import { APP_SYSTEM_NAME, APP_VERSION } from "@/lib/constants";
import { LoginShell, loginSubmitButtonClass } from "@/components/auth/LoginShell";

const PIN_LENGTH = 6;

export default function PosLoginPage() {
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const pinInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const submitLogin = useCallback(
    async (user: string, pinCode: string) => {
      if (!user.trim() || pinCode.length !== PIN_LENGTH) return;

      setIsLoading(true);
      setError("");
      try {
        await authApi.posLogin({
          username: user.trim().toLowerCase(),
          pin: pinCode,
        });

        showToast("Login successful! Redirecting...", "success");
        window.location.replace("/pos-terminal");
      } catch (err: unknown) {
        const axiosErr = err as {
          message?: string;
          response?: { data?: { message?: string } };
        };
        const message =
          !axiosErr.response && axiosErr.message === "Network Error"
            ? "Cannot connect to server. Make sure the backend is running on port 7005."
            : axiosErr.response?.data?.message || "Invalid username or PIN";
        setError(message);
        setPin("");
        pinInputRefs.current[0]?.focus();
        showToast(message, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [showToast]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitLogin(username, pin);
  };

  const canSubmit = !isLoading && !!username.trim() && pin.length === PIN_LENGTH;

  return (
    <LoginShell subtitle="Sign in with your username and PIN" error={error}>
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="pos-username" className="text-sm font-medium text-zinc-700">
            Username
          </label>
          <div className="group relative">
            <User className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-primary" />
            <input
              id="pos-username"
              type="text"
              value={username}
              onChange={e => {
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""));
                setError("");
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && username.trim()) {
                  e.preventDefault();
                  pinInputRefs.current[0]?.focus();
                }
              }}
              placeholder="your.username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isLoading}
              className="auth-input"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="pos-pin-0" className="text-sm font-medium text-zinc-700">
            PIN
          </label>
          <div className="flex w-full items-center gap-2.5">
            <Lock className="h-5 w-5 shrink-0 text-zinc-400" />
            <div
              className="grid min-w-0 flex-1 grid-cols-6 gap-2"
              onPaste={e => {
                e.preventDefault();
                const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
                if (!digits) return;
                setPin(digits);
                setError("");
                pinInputRefs.current[Math.min(digits.length, PIN_LENGTH) - 1]?.focus();
              }}
            >
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <input
                  key={index}
                  ref={element => { pinInputRefs.current[index] = element; }}
                  id={`pos-pin-${index}`}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={pin[index] || ""}
                  onChange={e => {
                    const digit = e.target.value.replace(/\D/g, "").slice(-1);
                    const nextPin = digit
                      ? `${pin.slice(0, index)}${digit}${pin.slice(index + 1)}`
                      : `${pin.slice(0, index)}${pin.slice(index + 1)}`;
                    setPin(nextPin.slice(0, PIN_LENGTH));
                    setError("");
                    if (digit && index < PIN_LENGTH - 1) pinInputRefs.current[index + 1]?.focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === "Backspace" && !pin[index] && index > 0) {
                      e.preventDefault();
                      setPin(pin.slice(0, index - 1) + pin.slice(index));
                      pinInputRefs.current[index - 1]?.focus();
                    }
                    if (e.key === "ArrowLeft" && index > 0) pinInputRefs.current[index - 1]?.focus();
                    if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) pinInputRefs.current[index + 1]?.focus();
                  }}
                  onFocus={e => e.currentTarget.select()}
                  disabled={isLoading}
                  aria-label={`PIN digit ${index + 1}`}
                  className="h-14 min-w-0 w-full rounded-md border border-zinc-300 bg-white text-center text-xl font-bold text-zinc-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  required
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPin(value => !value)}
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
            >
              {showPin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className={loginSubmitButtonClass(!canSubmit)}
          disabled={!canSubmit}
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

        <p className="text-center text-xs leading-relaxed text-zinc-400">
          {APP_SYSTEM_NAME}
          <br />
          Version {APP_VERSION}
        </p>
      </form>
    </LoginShell>
  );
}
