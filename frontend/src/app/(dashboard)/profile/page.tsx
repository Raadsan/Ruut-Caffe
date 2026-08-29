"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { authApi, AuthUser } from "@/lib/api/auth/authApi";
import { useToast } from "@/components/ui/toast";
import ProfileDetailsPanel, {
  ProfileDetailsSkeleton,
} from "@/components/profile/ProfileDetailsPanel";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";

const selectClass =
  "w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-800 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10";

function toFormState(currentUser: AuthUser) {
  let formattedDob = "";
  if (currentUser.dateOfBirth) {
    const d = new Date(currentUser.dateOfBirth);
    if (!isNaN(d.getTime())) formattedDob = d.toISOString().split("T")[0];
  }

  return {
    fullName: currentUser.fullName || "",
    email: currentUser.email || "",
    phone: currentUser.phone || "",
    address: currentUser.address || "",
    dateOfBirth: formattedDob,
    gender: currentUser.gender || "Male",
    avatarUrl: currentUser.avatarUrl || "",
    currentPassword: "",
    newPassword: "",
  };
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "Male",
    avatarUrl: "",
    currentPassword: "",
    newPassword: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const applyUser = (currentUser: AuthUser) => {
    setUser(currentUser);
    setFormData(toFormState(currentUser));
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const currentUser = await authApi.getMe(true);
      applyUser(currentUser);
    } catch {
      showToast("Failed to load profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatarUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    if (user) applyUser(user);
    else fetchUser();
  };

  const handleSave = async () => {
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        showToast("Enter your current password to change it", "error");
        return;
      }
      if (formData.newPassword.length < 6) {
        showToast("New password must be at least 6 characters", "error");
        return;
      }
    }

    try {
      setSaving(true);
      const updated = await authApi.updateProfile({
        fullName: formData.fullName.trim(),
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || undefined,
        avatarUrl: formData.avatarUrl,
        ...(formData.newPassword
          ? {
              currentPassword: formData.currentPassword,
              newPassword: formData.newPassword,
            }
          : {}),
      });

      applyUser(updated);
      setIsEditing(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      showToast("Profile updated successfully", "success");
      window.dispatchEvent(new CustomEvent("profile_updated"));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update profile";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDob = (value: string) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <ProfileDetailsSkeleton />
      </div>
    );
  }

  const display = user || {
    fullName: "User",
    email: "",
    phone: "",
    address: "",
    role: "Staff",
    id: 0,
  };

  return (
    <div className={cn(dashboardPageClass, "h-full overflow-y-auto")} style={dashboardPageStyle}>
      <div className="w-full max-w-none space-y-4">
        <div className={pageHeaderWrapperClass}>
          <h1 className={pageHeaderTitleClass}>My Profile</h1>
        </div>

        <ProfileDetailsPanel
          fullName={display.fullName}
          isActive
          avatarUrl={isEditing ? formData.avatarUrl : display.avatarUrl}
          phone={isEditing ? formData.phone : display.phone}
          email={isEditing ? formData.email : display.email}
          address={isEditing ? formData.address : display.address}
          isEditing={isEditing}
          saving={saving}
          onEdit={() => setIsEditing(true)}
          onCancel={handleCancel}
          onSave={handleSave}
          onAvatarClick={() => fileInputRef.current?.click()}
          onRemoveAvatar={handleRemoveAvatar}
          editFullName={formData.fullName}
          onEditFullNameChange={v => setFormData(p => ({ ...p, fullName: v }))}
          editPhone={formData.phone}
          onEditPhoneChange={v => setFormData(p => ({ ...p, phone: v }))}
          editEmail={formData.email}
          onEditEmailChange={v => setFormData(p => ({ ...p, email: v }))}
          editAddress={formData.address}
          onEditAddressChange={v => setFormData(p => ({ ...p, address: v }))}
          showPasswordSection
          currentPassword={formData.currentPassword}
          newPassword={formData.newPassword}
          onCurrentPasswordChange={v => setFormData(p => ({ ...p, currentPassword: v }))}
          onNewPasswordChange={v => setFormData(p => ({ ...p, newPassword: v }))}
          showCurrentPassword={showCurrentPassword}
          showNewPassword={showNewPassword}
          onToggleCurrentPassword={() => setShowCurrentPassword(p => !p)}
          onToggleNewPassword={() => setShowNewPassword(p => !p)}
          internalFields={[
            { label: "User Type", value: (display.role || "Staff").toUpperCase() },
            { label: "User ID", value: display.id ? `#${display.id}` : "—" },
            {
              label: "Member Since",
              value: display.createdAt
                ? new Date(display.createdAt).toLocaleDateString()
                : "—",
            },
          ]}
          detailFields={[
            {
              label: "Gender",
              value: formData.gender,
              edit: (
                <select
                  value={formData.gender}
                  onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                  className={selectClass}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              ),
            },
            {
              label: "Date of Birth",
              value: formatDob(formData.dateOfBirth),
              edit: (
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                  className={selectClass}
                />
              ),
            },
            { label: "Role", value: (display.role || "Staff").toUpperCase() },
            { label: "Email", value: display.email || "—" },
            { label: "Phone Number", value: display.phone || "—" },
            { label: "Address", value: display.address || "—", colSpan: 2 },
          ]}
        />

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
