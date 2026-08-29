"use client";

import React from "react";
import {
  Edit2,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileDetailRow {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}

function getInitial(name?: string) {
  const n = (name || "U").trim();
  return n.charAt(0).toUpperCase();
}

interface StaffProfileCardProps {
  fullName: string;
  subtitle?: string;
  avatarUrl?: string;
  showVerifiedBadge?: boolean;
  rows: ProfileDetailRow[];
  onCall?: () => void;
  onMessage?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  footerActions?: React.ReactNode;
  className?: string;
}

export default function StaffProfileCard({
  fullName,
  subtitle,
  avatarUrl,
  showVerifiedBadge = true,
  rows,
  onCall,
  onMessage,
  onSave,
  onEdit,
  primaryActionLabel = "Contact",
  onPrimaryAction,
  footerActions,
  className,
}: StaffProfileCardProps) {
  const primaryHandler = onPrimaryAction || onCall;

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] overflow-hidden",
        className
      )}
    >
      <div className="p-5 flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="size-16 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-50 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-xl font-bold text-zinc-600">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              getInitial(fullName)
            )}
          </div>
          {showVerifiedBadge && (
            <span className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
              <Star className="size-3.5 text-white fill-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-xl font-bold text-zinc-900 leading-tight truncate">{fullName}</h3>
          {subtitle && (
            <p className="text-sm text-zinc-400 mt-0.5 capitalize">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 text-zinc-400">
          <Mail className="size-4" />
          <Phone className="size-4" />
        </div>
      </div>

      <div className="border-t border-zinc-100 mx-5" />

      <div className="px-5 py-4 space-y-3.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
            <span className="font-semibold text-zinc-800 shrink-0">{row.label}</span>
            {row.children ? (
              <div className="flex-1 min-w-0 text-right">{row.children}</div>
            ) : (
              <span className="text-zinc-500 text-right break-all">{row.value || "—"}</span>
            )}
          </div>
        ))}
      </div>

      {(footerActions || primaryHandler || onMessage || onSave || onEdit) && (
        <div className="px-5 pb-5 pt-1 flex items-center gap-2">
          {primaryHandler && (
            <button
              type="button"
              onClick={primaryHandler}
              className="flex-1 h-11 rounded-full bg-amber-400 hover:bg-amber-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Phone className="size-4" />
              {primaryActionLabel}
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              onClick={onMessage}
              className="size-11 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-colors shrink-0"
              title="Message"
            >
              <MessageCircle className="size-4" />
            </button>
          )}
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              className="size-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center shadow-sm transition-colors shrink-0"
              title="Save"
            >
              <Save className="size-4" />
            </button>
          ) : onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="size-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center shadow-sm transition-colors shrink-0"
              title="Edit"
            >
              <Edit2 className="size-4" />
            </button>
          ) : null}
          {footerActions}
        </div>
      )}
    </div>
  );
}

export function StaffProfileCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white h-[320px] animate-pulse shadow-sm" />
  );
}
