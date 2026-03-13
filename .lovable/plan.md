

## Plan: Remove Google OAuth, Add "Coming Soon" Text

### Changes

**`src/pages/Login.tsx`**
- Remove the `handleGoogleLogin` function
- Remove the divider ("or") and Google OAuth button
- Add centered muted text: "Google login coming soon" below the form

**`src/pages/Register.tsx`**
- Remove the `handleGoogleSignup` function
- Remove the divider ("or") and Google OAuth button
- Add centered muted text: "Google login coming soon" below the form

Both pages will keep the email/password form and the sign-up/sign-in link at the bottom. The "Google login coming soon" text will be `text-xs text-muted-foreground text-center mt-4`.

