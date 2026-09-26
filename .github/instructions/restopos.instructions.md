---
description: Apply RestoPOS product, data-isolation, and interface conventions to all application changes.
applyTo: 'app/**/*.{ts,tsx,css},lib/**/*.{ts,tsx,js},supabase/**/*.{sql,ts}'
---

# RestoPOS application rules

- Treat the application as a multi-tenant restaurant SaaS. Scope user data by the authenticated user's `user_id` and preserve the active-shift relationship through `jornada_id` and `cierre_id`.
- Keep `base_inicial`, `totalEfectivoHoy`, `efectivoEsperadoParaConteoCierre`, and `efectivoReal` semantically distinct. The base is not shift cash, and expected cash is only for the physical closing comparison.
- Preserve closing history. A completed closing must remain auditable and must not be silently changed by current live-sales calculations.
- Treat expenses as payment-method-specific outflows linked to `jornada_id` and, when closed, `cierre_id`. Subtract expenses from the corresponding sales channel when calculating net closing amounts.
- Keep all visible copy in professional Spanish. Do not add emojis, decorative icons, redundant descriptions, or all-caps action labels.
- Use the existing account menu for profile information, theme customization, and logout. Theme changes must remain client-side and must not alter financial calculations.
- Never add Supabase credentials to tracked files. Use environment variables and expose errors instead of returning success-shaped fallbacks.
- Treat `SUPABASE_SERVICE_ROLE_KEY` as server-only: never read it in a Client Component, include it in a `NEXT_PUBLIC_*` variable, send it to the browser, or print it in logs. Browser queries use the anon-key client and must remain protected by RLS.
- In API routes that use the service-role client, authenticate the bearer/session token and authorize the caller's business role on the server before administrative reads or mutations. Do not trust client-provided owner IDs, role names, or target membership IDs as proof of authorization.
- Model staff accounts as separate Supabase Auth users associated through `miembros_negocio`; keep the username-to-synthetic-email convention identical in account creation and login. Resolve business membership from the database on every device, and require `activo = true`.
- Staff access is limited to tables and orders. Hide other tabs/actions in the UI and enforce the same boundary through RLS on each relevant table; frontend visibility is not authorization.
- For Auth-user and membership create/delete workflows, handle partial failures explicitly and keep both records consistent. Never report success if the Auth operation or membership operation failed.
- RLS is the tenant isolation boundary for direct browser Supabase operations. Review existing policies before changing them because permissive policies combine with `OR`; validate both `USING` and `WITH CHECK` for mutations and account for active membership state.
- Before declaring Vercel/production ready, verify the required environment variable names and deployment environment without displaying secret values, and confirm the database has the needed migrations applied. A local build alone does not validate either.
- Follow existing patterns before introducing abstractions. Validate app changes with lint, TypeScript, production build when applicable, and `git diff --check`.
