---
name: restopos-saas-context
description: Use when changing RestoPOS, especially sales, cash shifts, Supabase data, production, or the Spanish business interface.
---

# RestoPOS SaaS Context

RestoPOS is a Spanish-language SaaS for restaurant operations. It currently covers:

- Sales by table and payment method.
- Cash-register shifts (`jornadas`) and immutable cash closings (`cierres_caja`).
- Sales history linked to shifts and closings.
- Ingredient inventory, recipes/costs, and products.
- Operating expenses by payment method, linked to the active shift and its closing.
- Supabase authentication and persistence.

## Domain rules

### Tenant isolation

Every user-owned query and mutation must be scoped to the authenticated user's `user_id` whenever the table supports it. A sale belongs to the active shift through `jornada_id`; after closing, it is linked to `cierres_caja` through `cierre_id`.

Do not use all-time sales for an active shift. The active-shift set is:

```ts
ventas.filter((venta) => venta.jornada_id === jornadaId && !venta.cierre_id)
```

### Cash terminology

Keep these concepts separate in both code and UI:

- **Efectivo** in the closing summary: expected cash after adding the opening base and cash sales, then subtracting cash expenses.
- **Base del turno**: cash available when the shift opens.
- **Efectivo esperado para el conteo**: opening base plus shift cash sales minus cash expenses; use it only to calculate the physical closing difference.
- **Efectivo contado**: cash physically counted by the operator.

Never label the opening base plus cash sales as “Efectivo de turno” in a summary card.

### Closing behavior

Closing a shift records the system totals and physical totals in `cierres_caja`, associates the shift's sales with the closing, marks the shift as closed, and resets the active-shift state. Preserve the historical record; do not silently recalculate a completed closing from current sales.

Expenses are cash outflows. A closing must associate the active shift's expenses with the closing and compare net amounts by payment method:

- Net cash expected for counting = opening base + cash sales - cash expenses.
- Net card amount = card sales - card expenses.
- Net transfer amount = transfer sales - transfer expenses.

## Supabase and configuration

- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from local environment configuration.
- Never commit credentials or copy `.env.local` values into source, documentation, tests, or commits.
- Surface Supabase errors to the user using the existing Spanish error-reporting pattern; do not silently treat failed writes as successful.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Read it only in server code such as API route handlers; never prefix it with `NEXT_PUBLIC_`, import it from client components, or include it in responses/logs.
- Keep the anon-key Supabase client for browser operations subject to RLS. Use the service-role client only for narrowly scoped administrative operations after authenticating the caller and checking their business role.

### Business roles and staff access

- The primary authenticated account is the business administrator. A staff member is a separate Supabase Auth user connected to the administrator through `miembros_negocio` (`owner_user_id`, `auth_user_id`, `role`, and `activo`).
- Staff login uses a username that the client converts to the synthetic address `<lowercase-username>@usuarios.restopos.app`; keep that convention consistent in account creation and login. The Supabase Auth user and active membership row—not browser storage or user metadata alone—are the durable identity and business association, so access must resolve correctly on a new device.
- Only an authenticated business administrator may create or delete staff accounts. Verify the caller's session and membership/profile relationship on the server before using the service-role client; never accept an owner ID, role, or target membership as authorization merely because it came from the browser.
- Staff are limited to tables and orders. Hide administrative navigation and UI for usability, but enforce the same limits with database RLS; client-side route/tab hiding is not an authorization boundary.
- When creating a staff account, create the Auth user and membership consistently; if membership creation fails, remove the newly created Auth user and surface the original failure. When deleting, keep membership and Auth account state consistent and report partial failures explicitly.
- RLS policies must encode tenant membership and active status for every accessible business table. Check both `USING` and `WITH CHECK` for mutations, prevent inactive staff access, and avoid broad policies that let a user choose another tenant's `user_id`. Review existing policies before adding replacements because permissive PostgreSQL policies combine with `OR`.
- Any `SECURITY DEFINER` database function must set a fixed `search_path`, restrict execution grants to intended roles, validate `auth.uid()` against the target business/shift, and avoid trusting client-supplied ownership fields.

## Product and UI language

- Visible copy must be professional, concise, and in Spanish.
- Do not use emojis, decorative symbols, duplicated labels, or unnecessary all-caps in buttons and headings.
- Prefer action labels such as `Guardar pedido`, `Cobrar y facturar`, `Ver detalle`, and `Cerrar y guardar arqueo`.
- Keep destructive actions explicit and textual, for example `Eliminar producto`.
- Preserve the account menu as the place for profile details, theme customization, and session logout.

## Implementation and validation

Before editing, inspect the existing data flow and reuse established helpers and naming. For changes to this SaaS:

1. Run targeted lint and TypeScript checks.
2. Run `npm run build` for changes affecting app code, routes, or configuration.
3. Check `git diff --check`.
4. Do not publish to `main` or trigger a deployment unless the user explicitly requests publishing.

## Learnings

- A successful local build does not verify Vercel environment configuration or whether applied Supabase migrations match the repository. Check required server and public variables by name only (never print their values), and verify database policies/migrations separately before claiming production readiness.
- Keep the account-management screen and its destructive actions administrator-only, with clear confirmation and explicit error reporting. The UI can improve usability but must never substitute for server authorization or RLS.
