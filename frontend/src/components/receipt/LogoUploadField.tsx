"use client";

import React, { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToReceiptLogoDataUrl } from "@/lib/receipt-logo";
import { resolveBrandingImageUrl } from "@/lib/branding";

type LogoUploadFieldProps = {
  value: string;
  onChange: (dataUrl: string) => void;
  onError?: (message: string) => void;
};

export default function LogoUploadField({ value, onChange, onError }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToReceiptLogoDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="relative size-20 shrink-0 rounded-xl border-2 border-dashed border-zinc-200 dark:border-[#2a2a2a] bg-zinc-50 dark:bg-[#161616] flex items-center justify-center overflow-hidden">
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : value ? (
          <img
            src={resolveBrandingImageUrl(value) || value}
            alt="Restaurant logo"
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <ImageIcon className="size-7 text-zinc-300 dark:text-zinc-600" />
        )}
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <p className="text-[13px] font-semibold text-[#1e293b] dark:text-white">Restaurant logo</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
          PNG or JPG, square works best. Saved to server uploads folder for the sidebar.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="h-9 gap-1.5 font-semibold"
          >
            <Upload className="size-3.5" />
            {value ? "Change logo" : "Upload logo"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => onChange("")}
              className="h-9 text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold"
            >
              <X className="size-3.5 mr-1" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
