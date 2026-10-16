export type LoginFeedback = {
  error: unknown;
  showSessionRetry: boolean;
};

export function getLoginFeedback(
  authError: unknown,
  formError: string,
  hasToken: boolean,
): LoginFeedback | null {
  const error = authError ?? (formError ? new Error(formError) : null);
  if (error === null) return null;

  return {
    error,
    showSessionRetry: Boolean(authError && hasToken),
  };
}
