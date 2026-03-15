

## Plan: Rewrite Landing Page Content + Structure (Confirmed)

Confirming the 3 points raised:

1. **Pricing — Claude explicit in Essencial**: Yes. `free_features` array will explicitly list `"Gemini Flash, Gemini Pro & Claude"` as the second item in all 4 languages.

2. **Available AIs — 3 cards + 1 box**: Confirmed. Three separate cards (Flash, Pro, Claude) using `flash_desc`, `pro_desc`, `claude_desc` keys. The "Coming soon" box is a distinct element below with gold border + lower opacity — NOT a card. Claude is NOT in the coming soon list.

3. **Old Features section removed**: Confirmed. The 4 numbered feature blocks (01 Prompt Optimisation, 02 Smart Routing, 03 Cost Analytics, 04 Prompt Library) are fully replaced by "What You Get" with 3 cards (◆ ◇ ○). All related i18n keys (`landing.features.*`) will be removed from all 4 JSON files.

### Files Modified

| File | Scope |
|------|-------|
| `src/pages/Landing.tsx` | Full rewrite — 10 sections as specified |
| `src/i18n/locales/en.json` | Replace `landing` object only |
| `src/i18n/locales/pt.json` | Replace `landing` object only |
| `src/i18n/locales/fr.json` | Replace `landing` object only |
| `src/i18n/locales/es.json` | Replace `landing` object only |

No other files touched. Design system unchanged. Dark/light alternation: dark → dark → light → dark → light → dark → light → dark → dark.

### Pricing `free_features` (all languages)

- PT: `["5 pedidos por dia", "Gemini Flash, Gemini Pro & Claude", "Histórico de conversas", "Melhoria automática dos teus textos"]`
- EN: `["5 requests per day", "Gemini Flash, Gemini Pro & Claude", "Conversation history", "Automatic improvement of your texts"]`
- FR: `["5 demandes par jour", "Gemini Flash, Gemini Pro & Claude", "Historique des conversations", "Amélioration automatique de vos textes"]`
- ES: `["5 peticiones al día", "Gemini Flash, Gemini Pro & Claude", "Historial de conversaciones", "Mejora automática de tus textos"]`

Everything else as previously planned — same i18n key structure, same section order, same content.

