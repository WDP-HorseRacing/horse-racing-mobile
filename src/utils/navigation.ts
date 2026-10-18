import { router, type Href } from "expo-router";

/**
 * Safely navigates back if there is history in the stack, or replaces with the fallback route.
 * Prevents "The action 'GO_BACK' was not handled by any navigator" runtime errors when
 * screens are accessed directly, refreshed, or opened via replace navigation.
 */
export function safeBack(fallback: Href = "/") {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // React Navigation threw during canGoBack check; proceed to fallback
  }
  router.replace(fallback);
}
