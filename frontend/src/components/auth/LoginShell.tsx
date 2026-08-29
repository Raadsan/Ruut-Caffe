"use client";

import React from "react";
import { STATIC_APP_LOGO } from "@/lib/branding";
import { cn } from "@/lib/utils";

type LoginShellProps = {
  subtitle: string;
  error?: string;
  children: React.ReactNode;
};

export function LoginShell({ subtitle, error, children }: LoginShellProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f6f4f1] px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-100 bg-white px-8 pt-8 pb-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-10 sm:pt-9 sm:pb-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={STATIC_APP_LOGO}
            alt="Restaurant"
            className="mb-6 h-20 w-auto max-w-[280px] object-contain sm:h-24"
          />
          <p className="text-sm text-zinc-500">{subtitle}</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

export function loginSubmitButtonClass(disabled?: boolean) {
  return cn(
    "h-14 w-full rounded-md text-base font-semibold shadow-none",
    disabled && "opacity-60"
  );
}
