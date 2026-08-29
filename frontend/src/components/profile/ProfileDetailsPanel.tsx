"use client";

import React from "react";
import {
  Contact,
  Edit2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileField {
  label: string;
  value?: React.ReactNode;
  edit?: React.ReactNode;
  colSpan?: 1 | 2 | 3;
}

function getInitial(name?: string) {
  return (name || "U").trim().charAt(0).toUpperCase();
}

interface ProfileDetailsPanelProps {
  fullName: string;
  isActive?: boolean;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  internalFields?: ProfileField[];
  detailFields?: ProfileField[];
  isEditing?: boolean;
  saving?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  onAvatarClick?: () => void;
  onRemoveAvatar?: () => void;
  /** Controlled edit fields for About section */
  editFullName?: string;
  onEditFullNameChange?: (v: string) => void;
  editPhone?: string;
  onEditPhoneChange?: (v: string) => void;
  editEmail?: string;
  onEditEmailChange?: (v: string) => void;
  editAddress?: string;
  onEditAddressChange?: (v: string) => void;
  showPasswordSection?: boolean;
  currentPassword?: string;
  newPassword?: string;
  onCurrentPasswordChange?: (v: string) => void;
  onNewPasswordChange?: (v: string) => void;
  showCurrentPassword?: boolean;
  showNewPassword?: boolean;
  onToggleCurrentPassword?: () => void;
  onToggleNewPassword?: () => void;
  className?: string;
}

function FieldBlock({ label, value, edit, isEditing }: ProfileField & { isEditing?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-zinc-400 mb-1">{label}</p>
      {isEditing && edit ? (
        edit
      ) : (
        <p className="text-sm font-semibold text-zinc-800 break-words">{value ?? "—"}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

export default function ProfileDetailsPanel({
  fullName,
  isActive = true,
  avatarUrl,
  phone,
  email,
  address,
  internalFields = [],
  detailFields = [],
  isEditing = false,
  saving = false,
  canEdit = true,
  onEdit,
  onCancel,
  onSave,
  onAvatarClick,
  onRemoveAvatar,
  editFullName,
  onEditFullNameChange,
  editPhone,
  onEditPhoneChange,
  editEmail,
  onEditEmailChange,
  editAddress,
  onEditAddressChange,
  showPasswordSection = false,
  currentPassword = "",
  newPassword = "",
  onCurrentPasswordChange,
  onNewPasswordChange,
  showCurrentPassword,
  showNewPassword,
  onToggleCurrentPassword,
  onToggleNewPassword,
  className,
}: ProfileDetailsPanelProps) {
  const displayName = isEditing ? editFullName ?? fullName : fullName;

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
            <Contact className="size-4" />
          </div>
          <h2 className="text-base font-bold text-zinc-900">Profile Details</h2>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="h-9 px-4 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <X className="size-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : canEdit && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
          >
            <Edit2 className="size-3.5" />
            Edit
          </button>
        ) : null}
      </div>

      <div className="px-6 py-6 border-b border-zinc-100">
        <p className="text-xs font-semibold text-indigo-500/90 mb-4">About</p>
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
          <div className="shrink-0 self-start flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={isEditing ? onAvatarClick : undefined}
              disabled={!isEditing || !onAvatarClick}
              className={cn(
                "relative",
                isEditing && onAvatarClick && "cursor-pointer group"
              )}
            >
              <div className="size-24 sm:size-28 rounded-full bg-primary border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-3xl font-bold text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  getInitial(displayName)
                )}
              </div>
              {isEditing && onAvatarClick && (
                <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="size-6 text-white" />
                </span>
              )}
            </button>
            {isEditing && avatarUrl && onRemoveAvatar && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {isEditing && onEditFullNameChange ? (
                <input
                  type="text"
                  value={editFullName ?? ""}
                  onChange={e => onEditFullNameChange(e.target.value)}
                  className={cn(inputClass, "max-w-md font-bold text-lg h-11")}
                />
              ) : (
                <h3 className="text-2xl font-bold text-zinc-900">{fullName}</h3>
              )}
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md",
                  isActive ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-600"
                )}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="space-y-2.5 text-sm max-w-xl">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-zinc-400 shrink-0" />
                {isEditing && onEditPhoneChange ? (
                  <input
                    type="text"
                    value={editPhone ?? ""}
                    onChange={e => onEditPhoneChange(e.target.value)}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                ) : (
                  <span className="text-zinc-600">{phone || "—"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-zinc-400 shrink-0" />
                {isEditing && onEditEmailChange ? (
                  <input
                    type="email"
                    value={editEmail ?? ""}
                    onChange={e => onEditEmailChange(e.target.value)}
                    className={inputClass}
                    placeholder="Email address"
                  />
                ) : (
                  <a href={`mailto:${email}`} className="text-blue-600 hover:underline">
                    {email || "—"}
                  </a>
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="size-4 text-zinc-400 shrink-0 mt-2.5" />
                {isEditing && onEditAddressChange ? (
                  <input
                    type="text"
                    value={editAddress ?? ""}
                    onChange={e => onEditAddressChange(e.target.value)}
                    className={inputClass}
                    placeholder="Address"
                  />
                ) : (
                  <span className="text-zinc-600 pt-0.5">{address || "—"}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {internalFields.length > 0 && (
        <div className="px-6 py-5 border-b border-zinc-100">
          <p className="text-xs font-semibold text-indigo-500/90 mb-4">Internal</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {internalFields.map(f => (
              <FieldBlock key={f.label} {...f} isEditing={isEditing} />
            ))}
          </div>
        </div>
      )}

      {detailFields.length > 0 && (
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-indigo-500/90 mb-4">Account Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            {detailFields.map(f => (
              <div
                key={f.label}
                className={cn(
                  f.colSpan === 2 && "sm:col-span-2",
                  f.colSpan === 3 && "sm:col-span-3"
                )}
              >
                <FieldBlock {...f} isEditing={isEditing} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isEditing && showPasswordSection && (
        <div className="px-6 py-5 border-t border-zinc-100 bg-zinc-50/60">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="size-4 text-zinc-500" />
            <p className="text-xs font-semibold text-indigo-500/90">Change Password</p>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Enter your current password, then type the new password to update it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <p className="text-[11px] font-medium text-zinc-400 mb-1">Current Password</p>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => onCurrentPasswordChange?.(e.target.value)}
                  placeholder="Current password"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={onToggleCurrentPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400 mb-1">New Password</p>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => onNewPasswordChange?.(e.target.value)}
                  placeholder="New password"
                  className={cn(inputClass, "pr-10")}
                />
                <button
                  type="button"
                  onClick={onToggleNewPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProfileDetailsSkeleton() {
  return (
    <div className="w-full h-[480px] rounded-xl border border-zinc-200 bg-white animate-pulse" />
  );
}
