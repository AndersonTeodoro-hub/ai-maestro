// savvyowl-character-engine/core/character-engine.ts
// Motor central — orquestra expansão, refinamento, lock e geração de prompts.
// Em produção, substituir o storage em memória por chamadas ao DB da SavvyOwl.

import type {
  Character,
  ExpandedCharacter,
  CharacterStatus,
  ScenePromptConfig,
  GeneratedPrompts,
} from "../types/character";

import {
  EXPANSION_SYSTEM_PROMPT,
  buildExpansionMessage,
} from "../prompts/expansion";

import {
  REFINEMENT_SYSTEM_PROMPT,
  buildRefinementMessage,
} from "../prompts/refinement";

import {
  buildCharacterIdentityBlock,
  buildNanoBananaPrompt,
  buildVeo3Prompt,
  buildNegativePrompt,
} from "../prompts/generation";

// ─────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────

interface EngineConfig {
  /** Modelo Claude a usar. Sonnet para custo/qualidade, Opus para máxima fidelidade */
  model: string;
  /** Max tokens para resposta da API */
  maxTokens: number;
  /** Função de persistência — implementar com DB real em produção */
  storage: {
    save: (char: Character) => Promise<void>;
    load: (id: string) => Promise<Character | null>;
    loadAll: () => Promise<Character[]>;
    delete: (id: string) => Promise<void>;
  };
}

const DEFAULT_CONFIG: EngineConfig = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 4000,
  storage: createInMemoryStorage(), // substituir em produção
};

// ─────────────────────────────────────────────
// STORAGE IN-MEMORY (para desenvolvimento/prototipagem)
// ─────────────────────────────────────────────

function createInMemoryStorage() {
  const store = new Map<string, Character>();
  return {
    save: async (char: Character) => { store.set(char.id, char); },
    load: async (id: string) => store.get(id) || null,
    loadAll: async () => Array.from(store.values()),
    delete: async (id: string) => { store.delete(id); },
  };
}

// ─────────────────────────────────────────────
// CLAUDE API CALLER
// ─────────────────────────────────────────────

async function callClaudeAPI(
  systemPrompt: string,
  userMessage: string,
  config: EngineConfig
): Promise<ExpandedCharacter> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const text = data.content
    ?.map((block: any) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("") || "";

  // Clean JSON from potential markdown fences
  const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch (parseError) {
    throw new Error(`Failed to parse Claude response as JSON. Raw response: ${clean.substring(0, 200)}...`);
  }
}

// ─────────────────────────────────────────────
// CHARACTER ENGINE CLASS
// ─────────────────────────────────────────────

export class CharacterEngine {
  private config: EngineConfig;

  constructor(config?: Partial<EngineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── EXPAND ──────────────────────────────────
  /**
   * Recebe descrição em linguagem natural, retorna Character completo.
   * Este é o ponto de entrada principal para criar personagens.
   */
  async expand(userInput: string): Promise<Character> {
    if (!userInput.trim()) {
      throw new Error("Character description cannot be empty");
    }

    const expanded = await callClaudeAPI(
      EXPANSION_SYSTEM_PROMPT,
      buildExpansionMessage(userInput),
      this.config
    );

    const character: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      original_input: userInput.trim(),
      expanded,
      status: "pending",
      created_at: new Date().toISOString(),
      history: [
        {
          action: "created",
          input: userInput.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await this.config.storage.save(character);
    return character;
  }

  // ── REFINE ──────────────────────────────────
  /**
   * Ajusta um personagem existente com instrução em linguagem natural.
   * Só funciona em personagens com status "pending".
   */
  async refine(characterId: string, adjustment: string): Promise<Character> {
    const char = await this.config.storage.load(characterId);
    if (!char) throw new Error(`Character ${characterId} not found`);
    if (char.status === "locked") throw new Error("Cannot refine a locked character. Unlock first.");
    if (!adjustment.trim()) throw new Error("Adjustment description cannot be empty");

    const refined = await callClaudeAPI(
      REFINEMENT_SYSTEM_PROMPT,
      buildRefinementMessage(JSON.stringify(char.expanded, null, 2), adjustment),
      this.config
    );

    const updated: Character = {
      ...char,
      expanded: refined,
      history: [
        ...char.history,
        {
          action: "refined",
          input: adjustment.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await this.config.storage.save(updated);
    return updated;
  }

  // ── LOCK ────────────────────────────────────
  /**
   * Bloqueia o personagem. Nenhuma alteração permitida sem unlock.
   * Em produção, isto pode triggerar geração de reference sheets.
   */
  async lock(characterId: string): Promise<Character> {
    const char = await this.config.storage.load(characterId);
    if (!char) throw new Error(`Character ${characterId} not found`);

    const locked: Character = {
      ...char,
      status: "locked",
      locked_at: new Date().toISOString(),
      history: [
        ...char.history,
        { action: "locked", timestamp: new Date().toISOString() },
      ],
    };

    await this.config.storage.save(locked);
    return locked;
  }

  // ── UNLOCK ──────────────────────────────────
  async unlock(characterId: string): Promise<Character> {
    const char = await this.config.storage.load(characterId);
    if (!char) throw new Error(`Character ${characterId} not found`);

    const unlocked: Character = {
      ...char,
      status: "pending",
      locked_at: undefined,
      history: [
        ...char.history,
        { action: "unlocked", timestamp: new Date().toISOString() },
      ],
    };

    await this.config.storage.save(unlocked);
    return unlocked;
  }

  // ── GENERATE PROMPTS ────────────────────────
  /**
   * Gera prompts prontos para uso a partir de um personagem locked.
   * Este é o ponto de integração com o resto da SavvyOwl.
   */
  async generatePrompts(config: ScenePromptConfig): Promise<GeneratedPrompts> {
    const char = await this.config.storage.load(config.character_id);
    if (!char) throw new Error(`Character ${config.character_id} not found`);

    const expanded = char.expanded;
    const result: GeneratedPrompts = {
      character_block: buildCharacterIdentityBlock(expanded),
      negative: buildNegativePrompt(expanded),
    };

    // NanoBanana prompt (for img2vid and img_only flows)
    if (config.flow === "img2vid" || config.flow === "img_only") {
      result.nano_banana = buildNanoBananaPrompt(expanded);
    }

    // Veo3 prompt (for txt2vid and img2vid flows)
    if (config.flow === "txt2vid" || config.flow === "img2vid") {
      result.veo3 = buildVeo3Prompt(expanded, config.scene_description, {
        flow: config.flow,
        wardrobe_override: config.wardrobe_override,
        temporal_block: config.temporal_block,
      });
    }

    return result;
  }

  // ── CRUD ────────────────────────────────────
  async get(characterId: string): Promise<Character | null> {
    return this.config.storage.load(characterId);
  }

  async getAll(): Promise<Character[]> {
    return this.config.storage.loadAll();
  }

  async delete(characterId: string): Promise<void> {
    return this.config.storage.delete(characterId);
  }
}

// ─────────────────────────────────────────────
// EXPORT DEFAULT INSTANCE
// ─────────────────────────────────────────────

export const characterEngine = new CharacterEngine();
export default CharacterEngine;
