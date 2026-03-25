import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ENGINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-engine`;

async function callEngine(action: string, payload: Record<string, any> = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const resp = await fetch(ENGINE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Request failed");
  return data;
}

export interface CharacterData {
  id: string;
  user_id: string;
  original_input: string;
  expanded: any;
  status: "pending" | "locked";
  locked_at: string | null;
  history: any[];
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
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const remove = useCallback(async (characterId: string) => {
    setError(null);
    try {
      await callEngine("delete", { characterId });
      setCharacters((prev) => prev.filter((c) => c.id !== characterId));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  return { characters, loading, error, clearError, list, expand, refine, lock, unlock, remove };
}
