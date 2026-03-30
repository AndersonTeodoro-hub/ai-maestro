import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { buildCharacterIdentityBlock, buildNegativePrompt, buildWanT2VIdentity } from "@/lib/character-engine/generation";
import type { ExpandedCharacter } from "@/types/character";

interface CharacterData {
  id: string;
  name: string;
  summary: string;
  expanded: ExpandedCharacter;
  referenceImageUrl: string | null;
}

interface CharacterContextType {
  /** All locked characters for the current user */
  characters: CharacterData[];
  /** Currently active character (selected) */
  activeCharacter: CharacterData | null;
  /** The identity block text for the active character (Veo3/general) */
  identityBlock: string | null;
  /** Dense prose identity optimized for Wan 2.6 T2V (no image, text-only consistency) */
  wanT2VBlock: string | null;
  /** The negative prompt for the active character */
  negativePrompt: string | null;
  /** Display name of the active character */
  activeCharacterName: string | null;
  /** The canonical reference image URL for the active character */
  referenceImageUrl: string | null;
  /** Select a character by ID */
  selectCharacter: (id: string) => void;
  /** Clear selection */
  clearCharacter: () => void;
  /** Refresh characters from DB */
  refreshCharacters: () => Promise<void>;
  /** Loading state */
  loading: boolean;
}

const CharacterContext = createContext<CharacterContextType>({
  characters: [],
  activeCharacter: null,
  identityBlock: null,
  wanT2VBlock: null,
  negativePrompt: null,
  activeCharacterName: null,
  referenceImageUrl: null,
  selectCharacter: () => {},
  clearCharacter: () => {},
  refreshCharacters: async () => {},
  loading: false,
});

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [activeCharacter, setActiveCharacter] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCharacters = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("characters")
        .select("id, expanded, status, reference_image_url")
        .eq("user_id", user.id)
        .eq("status", "locked")
        .order("created_at", { ascending: false });

      if (data) {
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: c.expanded?.name || "?",
          summary: c.expanded?.summary || "",
          expanded: c.expanded as ExpandedCharacter,
          referenceImageUrl: c.reference_image_url || null,
        }));
        setCharacters(mapped);

        // If active character was deleted or unlocked, clear it
        if (activeCharacter && !mapped.find((c) => c.id === activeCharacter.id)) {
          setActiveCharacter(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, [user]);

  const selectCharacter = (id: string) => {
    const found = characters.find((c) => c.id === id);
    if (found) setActiveCharacter(found);
  };

  const clearCharacter = () => {
    setActiveCharacter(null);
  };

  const identityBlock = activeCharacter
    ? buildCharacterIdentityBlock(activeCharacter.expanded)
    : null;

  const wanT2VBlock = activeCharacter
    ? buildWanT2VIdentity(activeCharacter.expanded)
    : null;

  const negativePrompt = activeCharacter
    ? buildNegativePrompt(activeCharacter.expanded)
    : null;

  const referenceImageUrl = activeCharacter?.referenceImageUrl || null;

  return (
    <CharacterContext.Provider
      value={{
        characters,
        activeCharacter,
        identityBlock,
        wanT2VBlock,
        negativePrompt,
        activeCharacterName: activeCharacter?.name || null,
        referenceImageUrl,
        selectCharacter,
        clearCharacter,
        refreshCharacters: fetchCharacters,
        loading,
      }}
    >
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacter() {
  return useContext(CharacterContext);
}
