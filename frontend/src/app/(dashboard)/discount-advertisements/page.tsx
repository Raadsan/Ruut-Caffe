"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Megaphone,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/context/PermissionContext";
import {
  discountAdvertisementApi,
  DiscountAdvertisement,
} from "@/lib/api/restaurant/discountAdvertisementApi";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  actionBtnEdit,
  actionBtnDelete,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardStatusBadgeClass,
  btnCreatePage,
  pageHeaderWrapperClass,
  dashboardCardClass,
  dashboardControlsRowClass,
  dashboardTableWrapClass,
  dashboardPaginationClass,
  dashboardLabelClass,
  dashboardSelectClass,
  dashboardInputClass,
  getTableStatusBadgeClass,
} from "@/lib/dashboard-ui";

const formLabelClass = "text-xs font-medium text-[#1e293b] dark:text-zinc-200";
const formInputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm font-medium dark:text-white placeholder:text-zinc-400";

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function DiscountAdvertisementsPage() {
  const { showToast } = useToast();
  const { canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();
  const canAdd = checkAdd("/discount-advertisements");
  const canEdit = checkEdit("/discount-advertisements");
  const canDelete = checkDelete("/discount-advertisements");

  const [campaigns, setCampaigns] = useState<DiscountAdvertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<DiscountAdvertisement | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formStartAt, setFormStartAt] = useState("");
  const [formEndAt, setFormEndAt] = useState("");
  const [formActive, setFormActive] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const campaignData = await discountAdvertisementApi.getAll();
      setCampaigns(campaignData || []);
    } catch (err) {
      console.error(err);
      showToast("Failed to load advertisements", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return campaigns.filter((item) => {
      const haystack = `${item.title || ""} ${item.description || ""}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "live" && item.isCurrentlyActive) ||
        (statusFilter === "scheduled" && item.isActive && !item.isCurrentlyActive) ||
        (statusFilter === "disabled" && !item.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  function getAdStatusBadge(item: DiscountAdvertisement) {
    if (item.isCurrentlyActive) {
      return { label: "Live", className: getTableStatusBadgeClass("active") };
    }
    if (item.isActive) {
      return { label: "Scheduled", className: "bg-amber-500 text-white" };
    }
    return { label: "Disabled", className: getTableStatusBadgeClass("inactive") };
  }

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormImage("");
    setFormUrl("");
    setFormStartAt("");
    setFormEndAt("");
    setFormActive(true);
  };

  const openCreate = () => {
    setSelected(null);
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (item: DiscountAdvertisement) => {
    setSelected(item);
    setFormTitle(item.title || "");
    setFormDescription(item.description || "");
    setFormImage(item.imageUrl || "");
    setFormUrl(item.url || "");
    setFormStartAt(toLocalInputValue(item.startAt));
    setFormEndAt(toLocalInputValue(item.endAt));
    setFormActive(item.isActive);
    setIsFormOpen(true);
  };

  const openDelete = (item: DiscountAdvertisement) => {
    setSelected(item);
    setIsDeleteOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      showToast("Only PNG images are allowed", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image size should be less than 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFormImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      showToast("Title is required", "error");
      return;
    }
    if (!formImage) {
      showToast("PNG image is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: "advertisement" as const,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        imageUrl: formImage,
        url: formUrl.trim() || undefined,
        startAt: formStartAt ? new Date(formStartAt).toISOString() : undefined,
        endAt: formEndAt ? new Date(formEndAt).toISOString() : undefined,
        isActive: formActive,
      };

      if (selected) {
        await discountAdvertisementApi.update(selected.id, payload);
        showToast("Advertisement updated successfully", "success");
      } else {
        await discountAdvertisementApi.create(payload);
        showToast("Advertisement created successfully", "success");
      }

      setIsFormOpen(false);
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save advertisement";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await discountAdvertisementApi.delete(selected.id);
      showToast("Advertisement deleted successfully", "success");
      setIsDeleteOpen(false);
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete advertisement";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Advertisements</h1>
      </div>

      <div className={dashboardCardClass}>
        <div className={dashboardControlsRowClass}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className={dashboardLabelClass}>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={cn(dashboardSelectClass, "w-16 px-2")}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={dashboardLabelClass}>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(dashboardSelectClass, "w-40 px-3")}
              >
                <option value="all">All Status</option>
                <option value="live">Live</option>
                <option value="scheduled">Scheduled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search advertisements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(dashboardInputClass, "w-64")}
              />
            </div>

            {canAdd && (
              <Button className={btnCreatePage} onClick={openCreate}>
                <Plus className="size-4" />
                Add Advertisement
              </Button>
            )}
          </div>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Banner</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Title</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Description</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Schedule</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 bg-zinc-100 rounded w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-10 text-center text-zinc-500">
                      <Megaphone className="size-8 mx-auto mb-2 opacity-40" />
                      No advertisements found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => {
                    const status = getAdStatusBadge(item);
                    return (
                      <TableRow
                        key={item.id}
                        className="border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                      >
                        <TableCell className="px-6 py-3 text-[13px] text-zinc-500 font-medium">
                          {item.id}
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <div className="w-16 h-10 rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-zinc-100 bg-zinc-50">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title || "Advertisement"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="size-4 text-zinc-300" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <span className="text-[13px] font-medium text-zinc-700">
                            {item.title || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <span className="text-[13px] text-zinc-600 line-clamp-2 max-w-[240px]">
                            {item.description || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-[12px] text-zinc-600">
                          <div>Start: {formatDate(item.startAt)}</div>
                          <div>End: {formatDate(item.endAt)}</div>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <span className={cn(dashboardStatusBadgeClass, status.className)}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={actionBtnEdit}
                                onClick={() => openEdit(item)}
                              >
                                <Edit className="size-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={actionBtnDelete}
                                onClick={() => openDelete(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              &lt;
            </button>
            <div className="px-3 py-1 border border-zinc-200 rounded-md text-zinc-400">
              {currentPage} of {totalPages || 1}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>{selected ? "Edit Advertisement" : "Create Advertisement"}</DialogTitle>
          <DialogDescription>
            Upload a PNG banner for the mobile app homepage. Product discounts are managed from Menu Items.
          </DialogDescription>

          <div className="space-y-4 py-2">
            <div>
              <label className={formLabelClass}>Title</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className={formInputClass}
                placeholder="Fresh & Hot"
              />
            </div>

            <div>
              <label className={formLabelClass}>Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className={`${formInputClass} min-h-[80px]`}
                placeholder="Order your favorites today"
              />
            </div>

            <div>
              <label className={formLabelClass}>Banner Image (PNG only)</label>
              <input type="file" accept="image/png" onChange={handleImageUpload} />
              {formImage && (
                <div className="mt-3 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#2a2a2a]">
                  <img src={formImage} alt="Preview" className="w-full max-h-48 object-cover" />
                </div>
              )}
            </div>

            <div>
              <label className={formLabelClass}>URL (optional website link)</label>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className={formInputClass}
                placeholder="https://example.com/shop"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={formLabelClass}>Start Time (optional)</label>
                <input
                  type="datetime-local"
                  value={formStartAt}
                  onChange={(e) => setFormStartAt(e.target.value)}
                  className={formInputClass}
                />
              </div>
              <div>
                <label className={formLabelClass}>End Time (optional)</label>
                <input
                  type="datetime-local"
                  value={formEndAt}
                  onChange={(e) => setFormEndAt(e.target.value)}
                  className={formInputClass}
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              Active
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : selected ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogTitle>Delete Advertisement</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{selected?.title}&quot;?
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
