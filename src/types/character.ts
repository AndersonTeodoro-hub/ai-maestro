// savvyowl-character-engine/types/character.ts
// Estrutura de dados completa de um personagem no sistema SavvyOwl

export interface CharacterIdentity {
  gender: string;
  age: string;
  ethnicity_skin: string;
  reference: string; // celebrity/archetype cross-reference for AI anchoring
}

export interface CharacterFace {
  shape: string;
  forehead: string;
  eyes: string;
  eyebrows: string;
  nose: string;
  mouth: string;
  jaw_chin: string;
  ears: string;
  skin_marks: string; // moles, scars, pores, specific locations
}

export interface CharacterHair {
  color: string; // exact color with hex and lighting variations
  type_texture: string;
  length: string; // length by zone (top, sides, back)
  style: string;
  facial_hair: string;
}

export interface CharacterBody {
  height_build: string;
  posture: string;
  hands: string;
  movement_style: string;
  physical_asymmetries: string;
}

export interface CharacterWardrobe {
  style_archetype: string;
  typical_top: string;
  typical_bottom: string;
  footwear: string;
  accessories: string; // permanent accessories (jewelry, watch, etc)
  wardrobe_state: string;
}

export interface CharacterVoiceBehavior {
  voice_quality: string;
  emotional_baseline: string;
  micro_expressions: string;
  mannerisms: string;
}

/**
 * ExpandedCharacter — O JSON completo gerado pela expansão via Claude API.
 * Este é o "identity lock" que garante consistência entre gerações.
 */
export interface ExpandedCharacter {
  name: string;
  summary: string; // one-line description in user's language
  identity: CharacterIdentity;
  face: CharacterFace;
  hair: CharacterHair;
  body: CharacterBody;
  default_wardrobe: CharacterWardrobe;
  voice_behavior: CharacterVoiceBehavior;
  nano_banana_prompt: string; // self-contained prompt for image generation
  negative_prompt: string;
}

export type CharacterStatus = "pending" | "locked";

export interface CharacterHistoryEntry {
  action: "created" | "refined" | "locked" | "unlocked";
  input?: string;
  timestamp: string; // ISO 8601
}

/**
 * Character — A entidade completa armazenada no sistema.
 * Em produção, `id` vem do DB e `expanded` é o JSON imutável quando locked.
 */
export interface Character {
  id: string;
  original_input: string; // o que o usuário escreveu originalmente
  expanded: ExpandedCharacter;
  status: CharacterStatus;
  created_at: string;
  locked_at?: string;
  history: CharacterHistoryEntry[];
}

/**
 * ScenePromptConfig — Configuração para gerar prompts de cena.
 * Usado quando o usuário quer gerar vídeo/imagem com um personagem locked.
 */
export interface ScenePromptConfig {
  character_id: string;
  scene_description: string;
  flow: "txt2vid" | "img2vid" | "img_only";
  wardrobe_override?: Partial<CharacterWardrobe>; // para trocar roupa em cenas diferentes
  temporal_block?: string; // ex: "BLOCO-A (manhã dia 1)"
}

/**
 * GeneratedPrompts — Output do motor de geração de prompts.
 */
export interface GeneratedPrompts {
  nano_banana?: string; // prompt para gerar imagem de referência
  veo3?: string; // prompt para gerar vídeo
  negative?: string; // negative prompt
  character_block: string; // bloco de identidade isolado (para uso manual)
}
