import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENGINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-engine`;

// Get token once — no aggressive retry, no refresh loop
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faz login novamente.");
  return token;
}

async function callEngine(action: string, payload: Record<string, unknown> = {}) {
  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    throw new Error("Sessão expirada. Faz login novamente.");
  }

  const resp = await fetch(ENGINE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  // 401: session expired — refresh ONCE, quietly, no loop
  if (resp.status === 401) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData?.session?.access_token) {
      // Refresh failed — redirect to login cleanly
      throw new Error("Sessão expirada. Faz login novamente.");
    }
    // One retry with new token
    const retryResp = await fetch(ENGINE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshData.session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const retryData = await retryResp.json();
    if (!retryResp.ok) throw new Error(retryData.error || "Pedido falhou");
    return retryData;
  }

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Pedido falhou");
  return data;
}

export interface CharacterData {
  id: string;
  user_id: string;
  original_input: string;
  expanded: Record<string, unknown>;
  status: "pending" | "locked";
  locked_at: string | null;
  history: unknown[];
  created_at: string;
  updated_at: string;
}

export function useCharacterEngine() {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const list = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEngine("list");
      setCharacters(data.characters || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  const expand = useCallback(async (input: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEngine("expand", { input });
      const char = data.character;
      setCharacters((prev) => [char, ...prev]);
      return char;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refine = useCallback(async (characterId: string, adjustment: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEngine("refine", { characterId, adjustment });
      const updated = data.character;
      setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const lock = useCallback(async (characterId: string) => {
    setError(null);
    try {
      const data = await callEngine("lock", { characterId });
      const updated = data.character;
      setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      return null;
    }
  }, []);

  const unlock = useCallback(async (characterId: string) => {
    setError(null);
    try {
      const data = await callEngine("unlock", { characterId });
      const updated = data.character;
      setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      return updated;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      return null;
    }
  }, []);

  const remove = useCallback(async (characterId: string) => {
    setError(null);
    try {
      await callEngine("delete", { characterId });
      setCharacters((prev) => prev.filter((c) => c.id !== characterId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }, []);

  return { characters, loading, error, clearError, list, expand, refine, lock, unlock, remove };
}
