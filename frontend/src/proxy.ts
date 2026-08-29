import { NextResponse, type NextRequest } from "next/server";

const LOGIN_ROUTES = new Set(["/login", "/login/pos", "/pos", "/pos/login"]);

function isPublicRoute(pathname: string) {
  return LOGIN_ROUTES.has(pathname) ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/menu/") ||
    pathname.startsWith("/pos/ticket/");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const logoutLocked = request.cookies.get("restaurant_logout")?.value === "1";
  const hasSession = !logoutLocked && (
    request.cookies.has("restaurant_access") || request.cookies.has("restaurant_refresh")
  );

  if (!hasSession && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && LOGIN_ROUTES.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"],
};
