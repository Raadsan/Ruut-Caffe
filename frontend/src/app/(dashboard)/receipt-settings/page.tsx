"use client";

import React, { useState, useEffect } from "react";
import {
  Save,
  Printer,
  MapPin,
  Phone,
  Mail,
  Hash,
  Type,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Building2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { useToast } from "@/components/ui/toast";
import LogoUploadField from "@/components/receipt/LogoUploadField";
import { ReceiptBody } from "@/components/receipt/ReceiptBody";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export default function ReceiptSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState<{ provider: string; number: string }[]>([]);
  const [email, setEmail] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [footerText, setFooterText] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await receiptSettingsApi.getSettings();
      setName(data.name || "");
      setAddress(data.address || "");
      try {
        const parsedPhones = data.phone ? JSON.parse(data.phone) : [];
        setPhones(Array.isArray(parsedPhones) ? parsedPhones : []);
      } catch {
        setPhones([]);
      }
      setEmail(data.email || "");
      setVatNumber(data.vatNumber || "");
      setFooterText(data.footerText || "");
      setLogoUrl(data.logoUrl || "");
    } catch (err) {
      console.error("Failed to fetch settings", err);
      showToast("Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return showToast("Restaurant name is required", "error");

    setSaving(true);
    try {
      await receiptSettingsApi.updateSettings({
        name,
        address,
        phone: JSON.stringify(phones),
        email,
        vatNumber,
        footerText,
        logoUrl,
      });
      showToast("Receipt settings updated successfully", "success");
      await fetchSettings();
    } catch {
      showToast("Failed to update settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(dashboardPageClass, "pb-12")} style={dashboardPageStyle}>
      <div className={cn(pageHeaderWrapperClass, "flex justify-between items-end")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Receipt settings</h1>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={fetchSettings}
            disabled={loading}
            className="h-11 px-4 font-semibold"
          >
            <RefreshCw className={cn("size-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className={btnCreatePage}>
            {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
            Save settings
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="px-4 space-y-6 animate-pulse">
          <div className="h-64 trezo-card" />
          <div className="h-48 trezo-card" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
          <div className="lg:col-span-7 space-y-6">
            <div className="trezo-card overflow-hidden">
              <div className="px-8 py-6 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Company details</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Public information for the receipt header
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <Hash className="size-3.5 text-muted-foreground" />
                      VAT / Tax number
                    </label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="e.g. VAT-12345678"
                      className="w-full px-4 py-3 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    Address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, Country"
                    rows={2}
                    className="w-full px-4 py-3 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium resize-none dark:text-white"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground" />
                      Phone numbers & providers
                    </label>
                    <Button
                      type="button"
                      onClick={() => setPhones([...phones, { provider: "", number: "" }])}
                      className="h-8 px-3 text-[11px] font-semibold"
                      variant="outline"
                    >
                      + Add phone
                    </Button>
                  </div>

                  {phones.map((p, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={p.provider}
                          onChange={(e) => {
                            const next = [...phones];
                            next[idx].provider = e.target.value;
                            setPhones(next);
                          }}
                          placeholder="Provider (e.g. Hormuud)"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary text-sm font-medium dark:text-white"
                        />
                        <input
                          type="text"
                          value={p.number}
                          onChange={(e) => {
                            const next = [...phones];
                            next[idx].number = e.target.value;
                            setPhones(next);
                          }}
                          placeholder="Number"
                          className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary text-sm font-medium dark:text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                        className="size-10 shrink-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="trezo-card overflow-hidden">
              <div className="px-8 py-6 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <FileText className="size-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Additional info</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Logo and footer message
                  </p>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="size-3.5 text-muted-foreground" />
                    Restaurant logo
                  </label>
                  <LogoUploadField
                    value={logoUrl}
                    onChange={setLogoUrl}
                    onError={(msg) => showToast(msg, "error")}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Recommended: square format, PNG or JPG. This logo appears at the top of printed receipts only.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-foreground">Footer message</label>
                  <textarea
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. Thank you for visiting! Please come again."
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium resize-none dark:text-white"
                  />
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <label className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" />
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@restaurant.com"
                    className="w-full px-4 py-3 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Printer className="size-4 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Live receipt preview
                </span>
              </div>

              <div className="bg-white border border-border shadow-xl rounded-2xl overflow-hidden max-w-[320px] mx-auto">
                <ReceiptBody
                  data={{
                    orderId: 15176,
                    customerName: "Guest",
                    paymentMethod: "Cash",
                    orderTypeLabel: "Takeaway",
                    items: [
                      { menuItemId: 1, name: "Iced Latte", price: 2.21, quantity: 1 },
                      { menuItemId: 2, name: "Iced Spanish Latte", price: 2.76, quantity: 1 },
                    ],
                    subtotal: 4.97,
                    tax: 0.25,
                    total: 5.22,
                    createdAt: new Date().toISOString(),
                    servedBy: email || "admin@ruutcaffe.com",
                  }}
                  settings={{
                    name: name || "Ruut Caffe",
                    address: address || "",
                    phone: phones.length ? JSON.stringify(phones) : undefined,
                    vatNumber: vatNumber || undefined,
                    footerText: footerText || undefined,
                    email: email || undefined,
                    logoUrl: logoUrl || undefined,
                  } as any}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
