"use client";

import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { authApi } from "@/lib/api/auth/authApi";
import { useToast } from "@/components/ui/toast";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { accessToken?: string }; status?: string }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface SocialLoginButtonsProps {
  audience?: "client" | "staff";
  onSuccess?: () => void;
}

export function SocialLoginButtons({
  audience = "staff",
  onSuccess,
}: SocialLoginButtonsProps) {
  const { showToast } = useToast();
  const [fbReady, setFbReady] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";

  useEffect(() => {
    if (!facebookAppId || typeof window === "undefined") return;

    if (window.FB) {
      setFbReady(true);
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: facebookAppId,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
      setFbReady(true);
    };

    const existing = document.getElementById("facebook-jssdk");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      document.body.appendChild(script);
    }
  }, [facebookAppId]);

  const handleAuthSuccess = (userRole?: string) => {
    showToast("Login successful! Redirecting...", "success");
    onSuccess?.();

    setTimeout(() => {
      const role = userRole?.toLowerCase();
      if (role === "pos") {
        window.location.href = "/pos-terminal";
      } else if (audience === "client") {
        window.location.href = "/";
      } else {
        window.location.href = "/dashboard";
      }
    }, 1000);
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;

    try {
      setLoadingProvider("google");
      const res = await authApi.loginWithGoogle({
        idToken: credentialResponse.credential,
        audience,
      });
      handleAuthSuccess(res.user.role);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Google login failed";
      showToast(message, "error");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB || !fbReady) {
      showToast("Facebook login is not ready yet", "error");
      return;
    }

    window.FB.login(
      async (response) => {
        const accessToken = response.authResponse?.accessToken;
        if (!accessToken) {
          showToast("Facebook login cancelled", "error");
          return;
        }

        try {
          setLoadingProvider("facebook");
          const res = await authApi.loginWithFacebook({
            accessToken,
            audience,
          });
          handleAuthSuccess(res.user.role);
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Facebook login failed";
          showToast(message, "error");
        } finally {
          setLoadingProvider(null);
        }
      },
      { scope: "email,public_profile" }
    );
  };

  if (!googleClientId && !facebookAppId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">Or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {googleClientId ? (
          <div className="flex justify-center rounded-xl border border-border bg-background py-1">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => showToast("Google login failed", "error")}
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              width="100%"
            />
          </div>
        ) : null}

        {facebookAppId ? (
          <button
            type="button"
            onClick={handleFacebookLogin}
            disabled={!fbReady || loadingProvider === "facebook"}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
          >
            <span className="text-[#1877F2] font-bold">f</span>
            {loadingProvider === "facebook" ? "Signing in..." : "Facebook"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
