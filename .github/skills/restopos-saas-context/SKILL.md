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

- **Efectivo de turno**: cash sales collected during the active shift; it does not include the opening base.
- **Base del turno**: cash available when the shift opens.
- **Efectivo esperado para el conteo**: opening base plus shift cash sales; use it only to calculate the physical closing difference.
- **Efectivo contado**: cash physically counted by the operator.

Never label the opening base plus cash sales as “Efectivo de turno” in a summary card.

### Closing behavior

Closing a shift records the system totals and physical totals in `cierres_caja`, associates the shift's sales with the closing, marks the shift as closed, and resets the active-shift state. Preserve the historical record; do not silently recalculate a completed closing from current sales.

## Supabase and configuration

- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from local environment configuration.
- Never commit credentials or copy `.env.local` values into source, documentation, tests, or commits.
- Surface Supabase errors to the user using the existing Spanish error-reporting pattern; do not silently treat failed writes as successful.

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
