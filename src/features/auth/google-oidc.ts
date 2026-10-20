import type { GoogleOidcCallback } from "@/services/auth.service";

export const GOOGLE_OIDC_REDIRECT_URI = "horseracing://auth/callback";

export function parseGoogleOidcCallbackUrl(url: string): GoogleOidcCallback {
  const params = new URL(url).searchParams;
  const providerError = params.get("error");
  if (providerError) throw new Error(googleOidcProviderError(providerError));

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    throw new Error("The Google sign-in response is incomplete. Please try again.");
  }
  return { code, state };
}

export function googleOidcProviderError(code: string): string {
  return code === "access_denied"
    ? "You cancelled Google sign-in."
    : "Google or the authentication server rejected the sign-in.";
}
