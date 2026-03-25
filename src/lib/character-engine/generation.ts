// savvyowl-character-engine/prompts/generation.ts
// Funções que transformam um ExpandedCharacter em prompts prontos para cada ferramenta

import type { ExpandedCharacter, CharacterWardrobe } from "../types/character";

/**
 * Gera o bloco de identidade textual — o "DNA" que vai em todo prompt.
 * Este bloco é IDÊNTICO em todas as cenas do mesmo personagem.
 */
export function buildCharacterIdentityBlock(char: ExpandedCharacter): string {
  const d = char;
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push("║  CHARACTER IDENTITY LOCK — ABSOLUTE FIXED REFERENCE     ║");
  lines.push("║  DO NOT DEVIATE FROM ANY ATTRIBUTE BELOW                ║");
  lines.push("╚══════════════════════════════════════════════════════════╝");
  lines.push("");

  // Identity
  if (d.identity) {
    lines.push("── IDENTITY ──");
    if (d.identity.gender) lines.push(`  GENDER: ${d.identity.gender}`);
    if (d.identity.age) lines.push(`  AGE: ${d.identity.age}`);
    if (d.identity.ethnicity_skin) lines.push(`  SKIN: ${d.identity.ethnicity_skin}`);
    if (d.identity.reference) lines.push(`  VISUAL REFERENCE: ${d.identity.reference}`);
    lines.push("");
  }

  // Face
  if (d.face) {
    lines.push("── FACE GEOMETRY (FIXED) ──");
    if (d.face.shape) lines.push(`  FACE SHAPE: ${d.face.shape}`);
    if (d.face.forehead) lines.push(`  FOREHEAD: ${d.face.forehead}`);
    if (d.face.eyes) lines.push(`  EYES: ${d.face.eyes}`);
    if (d.face.eyebrows) lines.push(`  EYEBROWS: ${d.face.eyebrows}`);
    if (d.face.nose) lines.push(`  NOSE: ${d.face.nose}`);
    if (d.face.mouth) lines.push(`  MOUTH: ${d.face.mouth}`);
    if (d.face.jaw_chin) lines.push(`  JAW/CHIN: ${d.face.jaw_chin}`);
    if (d.face.ears) lines.push(`  EARS: ${d.face.ears}`);
    if (d.face.skin_marks) lines.push(`  SKIN MARKS: ${d.face.skin_marks}`);
    lines.push("");
  }

  // Hair
  if (d.hair) {
    lines.push("── HAIR (FIXED STATE) ──");
    if (d.hair.color) lines.push(`  COLOR: ${d.hair.color}`);
    if (d.hair.type_texture) lines.push(`  TYPE/TEXTURE: ${d.hair.type_texture}`);
    if (d.hair.length) lines.push(`  LENGTH: ${d.hair.length}`);
    if (d.hair.style) lines.push(`  STYLE: ${d.hair.style}`);
    if (d.hair.facial_hair) lines.push(`  FACIAL HAIR: ${d.hair.facial_hair}`);
    lines.push("");
  }

  // Body
  if (d.body) {
    lines.push("── BODY & MOVEMENT ──");
    if (d.body.height_build) lines.push(`  BUILD: ${d.body.height_build}`);
    if (d.body.posture) lines.push(`  POSTURE: ${d.body.posture}`);
    if (d.body.hands) lines.push(`  HANDS: ${d.body.hands}`);
    if (d.body.movement_style) lines.push(`  MOVEMENT: ${d.body.movement_style}`);
    if (d.body.physical_asymmetries) lines.push(`  ASYMMETRIES: ${d.body.physical_asymmetries}`);
    lines.push("");
  }

  // Wardrobe
  if (d.default_wardrobe) {
    lines.push("── WARDROBE ──");
    if (d.default_wardrobe.typical_top) lines.push(`  TOP: ${d.default_wardrobe.typical_top}`);
    if (d.default_wardrobe.typical_bottom) lines.push(`  BOTTOM: ${d.default_wardrobe.typical_bottom}`);
    if (d.default_wardrobe.footwear) lines.push(`  FEET: ${d.default_wardrobe.footwear}`);
    if (d.default_wardrobe.accessories) lines.push(`  ACCESSORIES: ${d.default_wardrobe.accessories}`);
    if (d.default_wardrobe.wardrobe_state) lines.push(`  STATE: ${d.default_wardrobe.wardrobe_state}`);
    lines.push("");
  }

  // Voice & Behavior
  if (d.voice_behavior) {
    lines.push("── VOICE & BEHAVIOR ──");
    if (d.voice_behavior.voice_quality) lines.push(`  VOICE: ${d.voice_behavior.voice_quality}`);
    if (d.voice_behavior.emotional_baseline) lines.push(`  EMOTIONAL BASELINE: ${d.voice_behavior.emotional_baseline}`);
    if (d.voice_behavior.micro_expressions) lines.push(`  MICRO-EXPRESSIONS: ${d.voice_behavior.micro_expressions}`);
    if (d.voice_behavior.mannerisms) lines.push(`  MANNERISMS: ${d.voice_behavior.mannerisms}`);
    lines.push("");
  }

  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push("║  SAME PERSON IN EVERY FRAME. NO VARIATION. NO DEVIATION ║");
  lines.push("╚══════════════════════════════════════════════════════════╝");

  return lines.join("\n");
}

/**
 * Gera prompt completo para NanoBanana (imagem de referência).
 * Usa o nano_banana_prompt gerado na expansão + character block como reforço.
 */
export function buildNanoBananaPrompt(
  char: ExpandedCharacter,
  options?: {
    framing?: string; // override do enquadramento (ex: "full body", "close-up")
    pose?: string; // pose específica
    lighting?: string; // override de iluminação
    background?: string; // background específico
    style_override?: string; // override de estilo fotográfico
  }
): string {
  const lines: string[] = [];

  lines.push("=== IMAGE GENERATION — CHARACTER REFERENCE ===");
  lines.push("");

  // Se tem opções custom, compõe prompt híbrido
  if (options && Object.values(options).some((v) => v?.trim())) {
    lines.push(buildCharacterIdentityBlock(char));
    lines.push("");
    lines.push("── IMAGE DIRECTION ──");
    if (options.framing) lines.push(`  FRAMING: ${options.framing}`);
    if (options.pose) lines.push(`  POSE: ${options.pose}`);
    if (options.lighting) lines.push(`  LIGHTING: ${options.lighting}`);
    if (options.background) lines.push(`  BACKGROUND: ${options.background}`);
    if (options.style_override) lines.push(`  STYLE: ${options.style_override}`);
    lines.push("");
    lines.push("PHOTOGRAPHIC MANDATE: Must look like a real photograph. Real skin texture,");
    lines.push("real imperfections, real lighting physics. NOT a render, NOT illustration.");
  } else {
    // Usa o nano_banana_prompt self-contained gerado na expansão
    lines.push(char.nano_banana_prompt);
  }

  lines.push("");
  lines.push("=== END IMAGE PROMPT ===");

  return lines.join("\n");
}

/**
 * Gera prompt completo para Veo3 (vídeo).
 * Character block + scene direction + technical mandates.
 */
export function buildVeo3Prompt(
  char: ExpandedCharacter,
  sceneDescription: string,
  options?: {
    flow: "txt2vid" | "img2vid";
    wardrobe_override?: Partial<CharacterWardrobe>;
    temporal_block?: string;
    camera?: string;
    sound_design?: string;
    strict_donts?: string;
  }
): string {
  const flow = options?.flow || "txt2vid";
  const lines: string[] = [];

  // Image-to-video header
  if (flow === "img2vid") {
    lines.push("╔══════════════════════════════════════════════════════════╗");
    lines.push("║  IMAGE-TO-VIDEO MODE — REFERENCE FRAME PROVIDED         ║");
    lines.push("║  The attached image IS the character. Match it exactly.  ║");
    lines.push("║  Do not alter face, hair, skin, clothing, or body.      ║");
    lines.push("║  The text below is REDUNDANT VERIFICATION.              ║");
    lines.push("╚══════════════════════════════════════════════════════════╝");
    lines.push("");
  }

  // Character identity block
  lines.push(buildCharacterIdentityBlock(char));
  lines.push("");

  // Wardrobe override (for scenes with different clothes)
  if (options?.wardrobe_override) {
    lines.push("── WARDROBE OVERRIDE (THIS SCENE ONLY) ──");
    const wo = options.wardrobe_override;
    if (wo.typical_top) lines.push(`  TOP: ${wo.typical_top}`);
    if (wo.typical_bottom) lines.push(`  BOTTOM: ${wo.typical_bottom}`);
    if (wo.footwear) lines.push(`  FEET: ${wo.footwear}`);
    if (wo.accessories) lines.push(`  ACCESSORIES: ${wo.accessories}`);
    lines.push("");
  }

  // Scene direction
  lines.push("── SCENE DIRECTION ──");
  if (options?.temporal_block) lines.push(`  TEMPORAL BLOCK: ${options.temporal_block}`);
  lines.push(`  ${sceneDescription}`);
  lines.push("");

  if (options?.camera) lines.push(`  CAMERA: ${options.camera}`);
  if (options?.sound_design) lines.push(`  SOUND: ${options.sound_design}`);
  lines.push("");

  // Technical mandates
  lines.push("── TECHNICAL MANDATE ──");
  lines.push("  CAMERA: Handheld, available light only, no stylization, no beauty filter");
  lines.push("  REALISM: Raw UGC aesthetic, imperfect movement, real human behavior");
  lines.push("  CONSISTENCY: Character above is a PHOTOGRAPHIC CONSTANT");

  if (flow === "img2vid") {
    lines.push("  REFERENCE LOCK: Provided image is GROUND TRUTH for appearance");
    lines.push("  Any deviation from reference image is a FAILURE");
  }

  if (options?.strict_donts) {
    lines.push("");
    lines.push(`  FORBIDDEN: ${options.strict_donts}`);
  }

  return lines.join("\n");
}

/**
 * Gera o negative prompt.
 * Combina o negative genérico com o específico do personagem.
 */
export function buildNegativePrompt(char: ExpandedCharacter): string {
  const base = "no perfect symmetry, no airbrushed skin, no CGI look, no illustration, no anime, no cartoon, no glamour lighting, no studio backdrop, no stock photo pose, no generic beauty, no filtered look, no oversaturated colors";
  return char.negative_prompt
    ? `${char.negative_prompt}, ${base}`
    : base;
}

/**
 * Conveniência — gera todos os prompts de uma vez para uma cena.
 */
export function generateAllPrompts(
  char: ExpandedCharacter,
  sceneDescription: string,
  flow: "txt2vid" | "img2vid" | "img_only" = "img2vid"
): {
  nanoBanana?: string;
  veo3?: string;
  negative: string;
  characterBlock: string;
} {
  const result: any = {
    negative: buildNegativePrompt(char),
    characterBlock: buildCharacterIdentityBlock(char),
  };

  if (flow === "img_only" || flow === "img2vid") {
    result.nanoBanana = buildNanoBananaPrompt(char);
  }

  if (flow === "txt2vid" || flow === "img2vid") {
    result.veo3 = buildVeo3Prompt(char, sceneDescription, { flow });
  }

  return result;
}
