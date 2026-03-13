

## Plan: Fix Google OAuth 404 Error

### Problem
The Google OAuth button code is already in place on both `/login` and `/register`, but clicking it results in a 404 error. This happens because the managed Google OAuth provider needs to be properly configured on the backend.

### Fix

1. **Re-run the Configure Social Auth tool** to ensure the Google provider is properly set up on the backend. This generates the correct OAuth endpoints that the `@lovable.dev/cloud-auth-js` package connects to.

2. **Bump the service worker cache version** in `public/sw.js` from `savvyowl-v1` to `savvyowl-v2` — the old cached `/~oauth` route may be serving a stale 404 response despite the exclusion rule being present.

3. **No changes needed to Login.tsx or Register.tsx** — the button code using `lovable.auth.signInWithOAuth("google", ...)` is already correct and present on both pages with the Google icon, full width, and "ou" divider.

### Files

| Action | File |
|--------|------|
| Configure | Social Auth (Google provider) |
| Modify | `public/sw.js` — bump cache version |

