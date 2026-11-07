// Turn Firebase auth error codes into sentences that say what to do next.
const MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right. Check it for typos.",
  "auth/user-not-found": "No account uses that email. Create one instead.",
  "auth/wrong-password": "That password doesn't match this account.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a minute, then try again.",
  "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
  "auth/popup-closed-by-user": "The sign-in window was closed before it finished.",
};

export function friendlyAuthError(err) {
  return MESSAGES[err?.code] || err?.message || "Something went wrong. Try again.";
}
