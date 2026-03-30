// savvyowl-character-engine/prompts/generation.ts
// Funções que transformam um ExpandedCharacter em prompts prontos para cada ferramenta

import type { ExpandedCharacter, CharacterWardrobe } from "@/types/character";

/**
 * Gera o bloco de identidade como PROSA NATURAL optimizada para ferramentas de IA.
 * Este texto é desenhado para ser colado diretamente no Veo3, Nano Banana, etc.
 * e produzir uma pessoa fotorealista e consistente.
 */
export function buildCharacterIdentityBlock(char: ExpandedCharacter): string {
  const d = char;
  const parts: string[] = [];

  // Header — instrução clara para a IA geradora
  parts.push("FIXED CHARACTER — same person in every frame, every scene, every generation.");
  parts.push("");

  // Identidade base em prosa natural
  const identity: string[] = [];
  if (d.identity?.gender) identity.push(d.identity.gender);
  if (d.identity?.age) identity.push(`${d.identity.age}`);
  if (d.identity?.ethnicity_skin) identity.push(`${d.identity.ethnicity_skin}`);
  if (identity.length > 0) {
    parts.push(`Subject: ${identity.join(", ")}.`);
  }
  if (d.identity?.reference) {
    parts.push(`Visual archetype: ${d.identity.reference}.`);
  }

  // Rosto — detalhes específicos que garantem consistência
  if (d.face) {
    const face: string[] = [];
    if (d.face.shape) face.push(`${d.face.shape} face`);
    if (d.face.eyes) face.push(`${d.face.eyes}`);
    if (d.face.eyebrows) face.push(`${d.face.eyebrows}`);
    if (d.face.nose) face.push(`${d.face.nose}`);
    if (d.face.mouth) face.push(`${d.face.mouth}`);
    if (d.face.jaw_chin) face.push(`${d.face.jaw_chin}`);
    if (d.face.forehead) face.push(`${d.face.forehead}`);
    if (d.face.skin_marks) face.push(`${d.face.skin_marks}`);
    if (d.face.skin_texture) face.push(`skin texture: ${d.face.skin_texture}`);
    if (face.length > 0) {
      parts.push(`Face: ${face.join(", ")}.`);
    }
  }

  // Cabelo
  if (d.hair) {
    const hair: string[] = [];
    if (d.hair.color) hair.push(d.hair.color);
    if (d.hair.type_texture) hair.push(d.hair.type_texture);
    if (d.hair.length) hair.push(d.hair.length);
    if (d.hair.style) hair.push(`styled ${d.hair.style}`);
    if (hair.length > 0) {
      parts.push(`Hair: ${hair.join(", ")}.`);
    }
    if (d.hair.facial_hair && d.hair.facial_hair.toLowerCase() !== "none") {
      parts.push(`Facial hair: ${d.hair.facial_hair}.`);
    }
  }

  // Corpo
  if (d.body) {
    const body: string[] = [];
    if (d.body.height_build) body.push(d.body.height_build);
    if (d.body.posture) body.push(d.body.posture);
    if (d.body.physical_asymmetries && d.body.physical_asymmetries.toLowerCase() !== "none") {
      body.push(d.body.physical_asymmetries);
    }
    if (body.length > 0) {
      parts.push(`Body: ${body.join(", ")}.`);
    }
  }

  // Guarda-roupa
  if (d.default_wardrobe) {
    const wardrobe: string[] = [];
    if (d.default_wardrobe.typical_top) wardrobe.push(d.default_wardrobe.typical_top);
    if (d.default_wardrobe.typical_bottom) wardrobe.push(d.default_wardrobe.typical_bottom);
    if (d.default_wardrobe.footwear) wardrobe.push(d.default_wardrobe.footwear);
    if (d.default_wardrobe.accessories) wardrobe.push(d.default_wardrobe.accessories);
    if (wardrobe.length > 0) {
      parts.push(`Wearing: ${wardrobe.join(", ")}.`);
    }
  }

  // Mandato de realismo UGC + prevenção de erros comuns
  parts.push("");
  parts.push("PHOTOREALISM MANDATE: This is a REAL person filmed with a smartphone. Visible skin pores, real skin texture with micro-imperfections, natural subsurface scattering, real hair strands with flyaways, authentic natural lighting, no airbrushing, no beauty filter, no CGI smoothness, no illustration. Shot on iPhone 15 Pro, handheld, available light. UGC authentic aesthetic. Anatomically correct hands with exactly five fingers. Natural human micro-movements: subtle weight shifts, breathing, eye blinks. If holding a phone or laptop, the screen MUST face toward the character and toward camera, never showing the back of the device.");

  return parts.join("\n");
}

/**
 * Gera prompt completo para NanoBanana (imagem de referência).
 * Usa o nano_banana_prompt gerado na expansão + character block como reforço.
 */
export function buildNanoBananaPrompt(
  char: ExpandedCharacter,
  options?: {
    framing?: string;
    pose?: string;
    lighting?: string;
    background?: string;
    style_override?: string;
  }
): string {
  const lines: string[] = [];

  if (options && Object.values(options).some((v) => v?.trim())) {
    lines.push(buildCharacterIdentityBlock(char));
    lines.push("");
    if (options.framing) lines.push(`Framing: ${options.framing}`);
    if (options.pose) lines.push(`Pose: ${options.pose}`);
    if (options.lighting) lines.push(`Lighting: ${options.lighting}`);
    if (options.background) lines.push(`Background: ${options.background}`);
    if (options.style_override) lines.push(`Style: ${options.style_override}`);
  } else {
    // Usa o nano_banana_prompt self-contained gerado na expansão
    lines.push(char.nano_banana_prompt);
  }

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

  if (flow === "img2vid") {
    lines.push("IMAGE-TO-VIDEO: The attached image IS the character. Match it exactly. Do not alter face, hair, skin, clothing, or body.");
    lines.push("");
  }

  // Character identity block em prosa natural
  lines.push(buildCharacterIdentityBlock(char));
  lines.push("");

  // Wardrobe override
  if (options?.wardrobe_override) {
    const wo = options.wardrobe_override;
    const overrides: string[] = [];
    if (wo.typical_top) overrides.push(`top: ${wo.typical_top}`);
    if (wo.typical_bottom) overrides.push(`bottom: ${wo.typical_bottom}`);
    if (wo.footwear) overrides.push(`shoes: ${wo.footwear}`);
    if (wo.accessories) overrides.push(`accessories: ${wo.accessories}`);
    if (overrides.length > 0) {
      lines.push(`WARDROBE THIS SCENE: ${overrides.join(", ")}.`);
      lines.push("");
    }
  }

  // Scene direction
  lines.push(`SCENE: ${sceneDescription}`);
  if (options?.temporal_block) lines.push(`Temporal: ${options.temporal_block}`);
  if (options?.camera) lines.push(`Camera: ${options.camera}`);
  if (options?.sound_design) lines.push(`Sound: ${options.sound_design}`);
  lines.push("");

  // Technical mandates
  lines.push("TECHNICAL: Handheld smartphone footage, available light only, no stylization, no beauty filter. Raw UGC aesthetic, imperfect movement, real human behavior. Same person in every frame.");

  if (flow === "img2vid") {
    lines.push("REFERENCE LOCK: The provided image is ground truth. Any deviation = failure.");
  }

  if (options?.strict_donts) {
    lines.push(`FORBIDDEN: ${options.strict_donts}`);
  }

  return lines.join("\n");
}

/**
 * Gera prosa descritiva densa optimizada para Wan 2.6 Text-to-Video.
 * O Wan 2.6 T2V não aceita imagem — a consistência vem 100% do texto.
 * Prosa fluida contínua porque modelos T2V respondem melhor a descrições naturais.
 * Inclui campos que o identityBlock ignora: hands, movement_style, ears, mannerisms.
 */
export function buildWanT2VIdentity(char: ExpandedCharacter): string {
  const d = char;
  const sentences: string[] = [];

  // Identidade central em prosa fluida
  const who: string[] = [];
  if (d.identity?.age) who.push(d.identity.age);
  if (d.identity?.gender) who.push(d.identity.gender.toLowerCase());
  if (d.identity?.ethnicity_skin) who.push(`with ${d.identity.ethnicity_skin}`);
  if (who.length > 0) sentences.push(`A ${who.join(", ")}.`);
  if (d.identity?.reference) sentences.push(`Resembles a blend of ${d.identity.reference}.`);

  // Rosto — todos os detalhes numa sequência contínua
  const face: string[] = [];
  if (d.face?.shape) face.push(`${d.face.shape} face shape`);
  if (d.face?.forehead) face.push(d.face.forehead);
  if (d.face?.eyes) face.push(d.face.eyes);
  if (d.face?.eyebrows) face.push(d.face.eyebrows);
  if (d.face?.nose) face.push(d.face.nose);
  if (d.face?.mouth) face.push(d.face.mouth);
  if (d.face?.jaw_chin) face.push(d.face.jaw_chin);
  if (d.face?.ears) face.push(d.face.ears);
  if (d.face?.skin_marks) face.push(d.face.skin_marks);
  if (face.length > 0) sentences.push(`Facial features: ${face.join(", ")}.`);
  if (d.face?.skin_texture) sentences.push(`Skin: ${d.face.skin_texture}.`);

  // Cabelo
  const hair: string[] = [];
  if (d.hair?.color) hair.push(d.hair.color);
  if (d.hair?.type_texture) hair.push(d.hair.type_texture);
  if (d.hair?.length) hair.push(d.hair.length);
  if (d.hair?.style) hair.push(`styled ${d.hair.style}`);
  if (hair.length > 0) sentences.push(`Hair: ${hair.join(", ")}.`);
  if (d.hair?.facial_hair && d.hair.facial_hair.toLowerCase() !== "none") {
    sentences.push(`Facial hair: ${d.hair.facial_hair}.`);
  }

  // Corpo completo — hands, movement_style incluídos
  const body: string[] = [];
  if (d.body?.height_build) body.push(d.body.height_build);
  if (d.body?.posture) body.push(d.body.posture);
  if (d.body?.hands) body.push(`hands: ${d.body.hands}`);
  if (d.body?.physical_asymmetries && d.body.physical_asymmetries.toLowerCase() !== "none") {
    body.push(d.body.physical_asymmetries);
  }
  if (body.length > 0) sentences.push(`Body: ${body.join(", ")}.`);
  if (d.body?.movement_style) sentences.push(`Movement: ${d.body.movement_style}.`);

  // Guarda-roupa com estado
  const wardrobe: string[] = [];
  if (d.default_wardrobe?.typical_top) wardrobe.push(d.default_wardrobe.typical_top);
  if (d.default_wardrobe?.typical_bottom) wardrobe.push(d.default_wardrobe.typical_bottom);
  if (d.default_wardrobe?.footwear) wardrobe.push(d.default_wardrobe.footwear);
  if (d.default_wardrobe?.accessories) wardrobe.push(d.default_wardrobe.accessories);
  if (d.default_wardrobe?.wardrobe_state) wardrobe.push(d.default_wardrobe.wardrobe_state);
  if (wardrobe.length > 0) sentences.push(`Wearing: ${wardrobe.join(", ")}.`);

  // Maneirismos — ajudam o T2V a gerar movimento consistente
  if (d.voice_behavior?.mannerisms) sentences.push(`Mannerisms: ${d.voice_behavior.mannerisms}.`);
  if (d.voice_behavior?.micro_expressions) sentences.push(`Expressions: ${d.voice_behavior.micro_expressions}.`);

  // Consistência T2V + realismo UGC
  sentences.push("CRITICAL: This is the SAME person in every frame — do not change face, hair, skin tone, body, or clothing at any point.");
  sentences.push("Photorealistic UGC shot on iPhone 15 Pro, handheld, natural light, visible skin pores, real hair with flyaways, no beauty filter, no CGI. Five fingers per hand. Natural micro-movements: breathing, weight shifts, eye blinks.");

  return sentences.join(" ");
}

/**
 * Gera o negative prompt.
 * Combina o negative genérico UGC com o específico do personagem.
 */
export function buildNegativePrompt(char: ExpandedCharacter): string {
  const base = [
    // Anti-AI look
    "perfect symmetry, airbrushed skin, CGI render, illustration, anime, cartoon, glamour lighting, studio backdrop, stock photo pose, generic beauty, filtered look, oversaturated colors, plastic skin, beauty filter, smooth poreless skin, perfect teeth, magazine retouching, dermabrasion, facetune, skin smoothing, wax skin, porcelain doll skin, uniform skin tone across entire face, age-inconsistent skin",
    // Veo3 common failures
    "screen on wrong side of device, screen on back of phone, screen on back of laptop, reversed phone screen, backwards tablet, text appearing mirrored, text on wrong surface, phone held backwards, laptop screen facing away from user",
    // Other common AI failures
    "extra fingers, missing fingers, deformed hands, extra limbs, mutated face, two faces, clone of character, duplicate person in frame, text overlay burned into skin, watermark, logo on clothing that wasn't specified"
  ].join(", ");
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
