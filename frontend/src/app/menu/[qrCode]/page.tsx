"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Search,
  UtensilsCrossed,
  MapPin,
  Image as ImageIcon,
  Star,
  Loader2,
  Sparkles,
  Plus,
  ShoppingBag,
  X,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  menuItemApi,
  MenuItem,
  PublicMenuCategory,
  PublicMenuData,
} from "@/lib/api/restaurant/menuItemApi";
import { cartApi, Cart } from "@/lib/api/restaurant/cartApi";
import {
  getMenuItemEffectivePrice,
  getMenuItemDiscountPercent,
  menuItemHasDiscount,
} from "@/lib/menu-item-pricing";
import { STATIC_APP_LOGO } from "@/lib/branding";
import { APP_SYSTEM_NAME } from "@/lib/constants";

export default function PublicTableMenuPage() {
  const params = useParams();
  const rawCode = params?.qrCode;
  const qrCode = decodeURIComponent(
    Array.isArray(rawCode) ? rawCode[0] : rawCode || ""
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuData, setMenuData] = useState<PublicMenuData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderDoneId, setOrderDoneId] = useState<number | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuData?.table?.id) return;
    setCartLoading(true);
    cartApi
      .getOrCreateCart(String(menuData.table.id))
      .then(setCart)
      .catch(() => setCartError("Could not load cart"))
      .finally(() => setCartLoading(false));
  }, [menuData?.table?.id]);

  const handleAddToCart = async (item: MenuItem) => {
    if (!cart || !item.isAvailable) return;
    if (item.isComposite && item.components?.some((c) => c.isAvailable === false)) {
      setCartError("This combo has unavailable items");
      return;
    }
    setCartError(null);
    try {
      const updated = await cartApi.addToCart({
        cartId: cart.id,
        menuItemId: String(item.id),
        quantity: 1,
      });
      setCart(updated);
      setCartOpen(true);
    } catch {
      setCartError("Could not add item");
    }
  };

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) return;
    setOrdering(true);
    setCartError(null);
    try {
      const result = await cartApi.checkoutCart({ cartId: cart.id });
      setOrderDoneId(Number(result.orderId));
      setCartOpen(false);
      if (menuData?.table?.id) {
        const fresh = await cartApi.getOrCreateCart(String(menuData.table.id));
        setCart(fresh);
      }
    } catch {
      setCartError("Order failed — please try again");
    } finally {
      setOrdering(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!cart) return;
    try {
      const updated = await cartApi.removeCartItem(itemId);
      setCart(updated);
    } catch {
      setCartError("Could not remove item");
    }
  };

  const cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  useEffect(() => {
    if (!qrCode) {
      setError("Invalid QR code");
      setLoading(false);
      return;
    }

    menuItemApi
      .getPublicMenuByQrCode(qrCode)
      .then((data) => {
        setMenuData(data);
        setError(null);
      })
      .catch(() => {
        setError("Table not found or menu unavailable. Please scan a valid table QR code.");
      })
      .finally(() => setLoading(false));
  }, [qrCode]);

  const categories = menuData?.categories ?? [];

  const allItems = useMemo(() => {
    const items: (MenuItem & { categoryName: string })[] = [];
    for (const cat of categories) {
      for (const item of cat.menuitem || []) {
        items.push({ ...item, categoryName: cat.name });
      }
    }
    return items;
  }, [categories]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.categoryId === selectedCategory;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allItems, selectedCategory, search]);

  const itemsByCategory = useMemo(() => {
    if (selectedCategory !== "all") {
      const cat = categories.find((c) => c.id === selectedCategory);
      return cat ? [{ category: cat, items: filteredItems }] : [];
    }

    return categories
      .map((category) => ({
        category,
        items: filteredItems.filter((i) => i.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, filteredItems, selectedCategory]);

  const tableLabel = menuData?.table
    ? menuData.table.name?.trim() || `Table ${menuData.table.number}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#faf8f5] to-[#f0ebe3] gap-4">
        <div className="size-16 rounded-2xl bg-white shadow-lg shadow-primary/10 flex items-center justify-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
        <p className="text-sm text-zinc-500 font-medium tracking-wide">Preparing your menu…</p>
      </div>
    );
  }

  if (error || !menuData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#faf8f5] to-[#f0ebe3] px-6 text-center">
        <div className="size-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-5">
          <UtensilsCrossed className="size-9 text-zinc-300" />
        </div>
        <h1 className="text-xl font-bold text-zinc-800 mb-2">Menu unavailable</h1>
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-2xl mx-auto px-5 pt-8 pb-10 text-white">
          <div className="flex items-center gap-4 mb-5">
            <div className="size-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center p-2 shrink-0">
              <img
                src={STATIC_APP_LOGO}
                alt={APP_SYSTEM_NAME}
                className="h-full w-full max-h-10 object-contain brightness-0 invert"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 mb-0.5">
                Digital Menu
              </p>
              <h1 className="text-2xl font-black tracking-tight truncate">
                Ruut Caffe Menu
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/25 text-xs font-semibold">
              <MapPin className="size-3.5" />
              {tableLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 text-xs font-medium text-white/80">
              <Sparkles className="size-3" />
              {allItems.length} dishes · {categories.length} categories
            </span>
          </div>

          {/* Search — overlaps hero */}
          <div className="relative">
            <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients…"
              className="w-full h-12 pl-11 pr-4 bg-white rounded-2xl text-sm text-zinc-800 placeholder:text-zinc-400 outline-none shadow-xl shadow-black/10 border-0 focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      {/* Sticky category bar */}
      <div className="sticky top-0 z-20 bg-[#faf8f5]/95 backdrop-blur-md border-b border-zinc-200/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <CategoryPill
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            label="All"
            count={allItems.length}
          />
          {categories.map((cat: PublicMenuCategory) => (
            <CategoryPill
              key={cat.id}
              active={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              label={cat.name}
              count={cat.menuitem?.length || 0}
            />
          ))}
        </div>
      </div>

      {/* Menu */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-28 space-y-10">
        {orderDoneId && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Order sent to kitchen!</p>
              <p className="text-xs text-emerald-700 mt-0.5">Order #{orderDoneId}</p>
            </div>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="size-16 rounded-2xl bg-white shadow-md flex items-center justify-center mx-auto mb-4">
              <Search className="size-7 text-zinc-300" />
            </div>
            <p className="text-base font-semibold text-zinc-700">No dishes found</p>
            <p className="text-sm text-zinc-400 mt-1">Try a different search or category</p>
          </div>
        ) : (
          itemsByCategory.map(({ category, items }) => (
            <section key={category.id}>
              <CategoryBanner category={category} show={selectedCategory === "all"} />

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {items.map((item) => (
                  <MenuItemCard key={item.id} item={item} onAdd={() => handleAddToCart(item)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Floating cart */}
      {cart && cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-4 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            {!cartOpen ? (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="w-full flex items-center justify-between gap-3 bg-primary text-white rounded-2xl px-5 py-4 shadow-2xl shadow-primary/30 font-bold"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="size-5" />
                  View order ({cartCount})
                </span>
                <span className="tabular-nums">${cart.totalAmount.toFixed(2)}</span>
              </button>
            ) : (
              <div className="bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                  <h3 className="font-bold text-zinc-900">Your order</h3>
                  <button type="button" onClick={() => setCartOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-zinc-50">
                  {cart.items.map((row) => (
                    <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">
                          {row.menuItem?.name || "Item"}
                          {row.menuItem?.isComposite && (
                            <span className="ml-1.5 text-[10px] font-bold uppercase text-violet-600">Combo</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-400">${row.unitPrice.toFixed(2)} each</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums">×{row.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(row.id)}
                        className="size-8 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-red-500"
                      >
                        <Minus className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {cartError && (
                  <p className="px-4 py-2 text-xs text-red-600 bg-red-50">{cartError}</p>
                )}
                <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                  <span className="text-lg font-black text-primary tabular-nums">
                    ${cart.totalAmount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    disabled={ordering || cartLoading}
                    onClick={handleCheckout}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-60"
                  >
                    {ordering ? "Sending…" : "Place order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="py-5 text-center border-t border-zinc-200/80 bg-white/60 backdrop-blur-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
          Enjoy your meal
        </p>
      </footer>
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200",
        active
          ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
          : "bg-white text-zinc-600 border border-zinc-200/80 hover:border-primary/30 hover:text-primary shadow-sm"
      )}
    >
      {label}
      <span className={cn("ml-1.5 tabular-nums", active ? "text-white/80" : "text-zinc-400")}>
        {count}
      </span>
    </button>
  );
}

function CategoryBanner({
  category,
  show,
}: {
  category: PublicMenuCategory;
  show: boolean;
}) {
  if (!show) return null;

  if (category.imageUrl) {
    return (
      <div className="relative rounded-3xl overflow-hidden mb-6 h-48 sm:h-56 md:h-64 shadow-lg">
        <img
          src={category.imageUrl}
          alt={category.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow">{category.name}</h2>
          {category.description && (
            <p className="text-sm text-white/90 mt-1 line-clamp-2">{category.description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 mb-6">
      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/15">
        <UtensilsCrossed className="size-6 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{category.name}</h2>
        {category.description && (
          <p className="text-sm text-zinc-500 mt-0.5">{category.description}</p>
        )}
      </div>
    </div>
  );
}

function MenuItemCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const hasDiscount = menuItemHasDiscount(item);
  const effectivePrice = getMenuItemEffectivePrice(item);
  const discountPct = getMenuItemDiscountPercent(item);
  const comboParts =
    item.isComposite && item.components?.length
      ? item.components.map((c) => `${c.quantity}× ${c.name}`).join(" · ")
      : null;

  return (
    <article className="group bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-50 to-zinc-100">
            <ImageIcon className="size-8 text-zinc-300" />
          </div>
        )}

        {item.isRecommended && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider shadow-md">
            <Star className="size-2.5 fill-current" />
            Popular
          </span>
        )}

        {item.isComposite && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 text-white text-[9px] font-black uppercase tracking-wider shadow-md">
            Combo
          </span>
        )}

        {hasDiscount && discountPct > 0 && (
          <span className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-black shadow-md">
            -{discountPct}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="text-sm font-bold text-zinc-900 leading-snug line-clamp-2 min-h-[2.5rem]">
          {item.name}
        </h3>

        {comboParts && (
          <p className="text-[10px] text-violet-600 font-medium mt-1 line-clamp-2">{comboParts}</p>
        )}

        {item.description && (
          <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1.5 leading-relaxed flex-1">
            {item.description}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
          {hasDiscount || (item.savings != null && item.savings > 0) ? (
            <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
              <span className="text-base font-black text-primary tabular-nums">
                ${effectivePrice.toFixed(2)}
              </span>
              {(hasDiscount || item.componentsTotal) && (
                <span className="text-[11px] text-zinc-400 line-through tabular-nums">
                  ${Number(item.componentsTotal ?? item.price).toFixed(2)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-base font-black text-primary tabular-nums">
              ${effectivePrice.toFixed(2)}
            </span>
          )}
          <button
            type="button"
            onClick={onAdd}
            disabled={!item.isAvailable}
            className="size-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md disabled:opacity-40 shrink-0"
            aria-label={`Add ${item.name}`}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
