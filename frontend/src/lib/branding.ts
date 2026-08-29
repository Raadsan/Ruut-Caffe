/** Default static logo in /public — used on login & POS header (not from database). */
export const STATIC_APP_LOGO = "/logo.png";

export function resolveBrandingImageUrl(url?: string | null): string | null {
  return url || null;
}

/** Menu item images from /uploads/menu/ or external URLs. */
export const resolveMenuImageUrl = resolveBrandingImageUrl;
