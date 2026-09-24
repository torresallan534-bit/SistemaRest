---
description: Apply RestoPOS product, data-isolation, and interface conventions to all application changes.
applyTo: 'app/**/*.{ts,tsx,css},lib/**/*.{ts,tsx,js},supabase/**/*.{sql,ts}'
---

# RestoPOS application rules

- Treat the application as a multi-tenant restaurant SaaS. Scope user data by the authenticated user's `user_id` and preserve the active-shift relationship through `jornada_id` and `cierre_id`.
- Keep `base_inicial`, `totalEfectivoHoy`, `efectivoEsperadoParaConteoCierre`, and `efectivoReal` semantically distinct. The base is not shift cash, and expected cash is only for the physical closing comparison.
- Preserve closing history. A completed closing must remain auditable and must not be silently changed by current live-sales calculations.
- Keep all visible copy in professional Spanish. Do not add emojis, decorative icons, redundant descriptions, or all-caps action labels.
- Use the existing account menu for profile information, theme customization, and logout. Theme changes must remain client-side and must not alter financial calculations.
- Never add Supabase credentials to tracked files. Use environment variables and expose errors instead of returning success-shaped fallbacks.
- Follow existing patterns before introducing abstractions. Validate app changes with lint, TypeScript, production build when applicable, and `git diff --check`.
