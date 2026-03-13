

## Auditoria Completa: Preços Desalinhados

### Problemas Encontrados

**Stripe (fonte de verdade):**
- Starter: €9/mês (`price_1T9oNWKg016ceaDVTLnC3PD7`)
- Pro: €19/mês (`price_1T9oNrKg016ceaDVfoGdfk6W`)

**1. Landing.tsx — Preços hardcoded ERRADOS (linhas 418, 442)**
- Mostra `€0` para Essencial e `€12` para Profissional
- Deveria mostrar `€9` (Starter) e `€19` (Pro)

**2. Settings page translations — Preços ERRADOS em TODOS os 4 idiomas (en, pt, fr, es)**
- `upgradeStarter`: mostra "€19" — deveria ser "€9"
- `upgradePro`: mostra "€49" — deveria ser "€19"

**3. Landing page — Nomes dos planos desalinhados**
- Mostra "ESSENCIAL" (free) + "PROFISSIONAL" — mas Stripe tem "Starter" + "Pro"
- O plano free (€0) não existe no Stripe

### Decisão Necessária

Antes de implementar, preciso saber: quer manter 3 tiers (Free €0 + Starter €9 + Pro €19) ou apenas 2 tiers alinhados com o Stripe (Starter €9 + Pro €19)?

### Plano de Implementação

1. **Landing.tsx** — Atualizar preços hardcoded de €0/€12 para os valores corretos
2. **pt.json** — Corrigir `upgradeStarter` para €9, `upgradePro` para €19
3. **en.json** — Corrigir `upgradeStarter` para €9, `upgradePro` para €19
4. **fr.json** — Corrigir `upgradeStarter` para 9€, `upgradePro` para 19€
5. **es.json** — Corrigir `upgradeStarter` para 9€, `upgradePro` para 19€
6. **Opcionalmente** atualizar nomes dos planos na landing page para alinhar com Stripe

### Impacto
Alterações apenas em ficheiros de tradução (.json) e Landing.tsx. Sem alterações de lógica ou backend.

