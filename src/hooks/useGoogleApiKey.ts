import { useAuth } from "@/contexts/AuthContext";

export function useGoogleApiKey(): string | null {
  const { user } = useAuth();
  if (!user?.id) return null;
  return localStorage.getItem(`savvyowl_google_key_${user.id}`) || null;
}
