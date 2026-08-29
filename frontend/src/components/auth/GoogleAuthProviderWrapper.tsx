"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

export function GoogleAuthProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  if (!googleClientId) {
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>{children}</GoogleOAuthProvider>
  );
}
