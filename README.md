# LabStock

LabStock is a laboratory reagent inventory app for searching, adding, editing, and deleting reagent records.

## Architecture

- Next.js frontend and API routes
- Server-side Cloudflare D1 database for the inventory
- Invite-code access gate configured as a runtime secret
- SVG favicon and responsive blue laboratory inventory interface

The real laboratory inventory is intentionally not included in this repository. It remains in the private server-side database and can be managed through the app.

## Local development

```bash
pnpm install
pnpm dev
```

## Production

The app needs a D1-compatible database binding named `DB` and the runtime secret `LABSTOCK_INVITE_CODE`. Keep both outside source control.

For a Cloudflare Worker build, provide `CLOUDFLARE_D1_DATABASE_ID` and optionally `CLOUDFLARE_D1_DATABASE_NAME` during the build so the generated Worker configuration points to the correct D1 database.
