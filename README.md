# GTM Automation Studio

A full-stack Next.js app for automating and auditing Google Tag Manager via the official GTM API v2. Deploy to Vercel or Render in minutes.

## Features

**🔍 Audit Mode**
- Full container scan: tags, triggers, variables, built-in variables
- Issue detection: unassigned tags, unused triggers, orphaned variables, duplicate names, paused tags
- Health score (0–100) based on severity-weighted issue count
- Sortable issue table with error / warn / info levels

**⚡ Create / Automate Mode**
- Manual tag, trigger, and variable creation with live payload preview
- DataLayer doc upload (CSV or XLSX) → auto-creates Custom Event triggers + DLV variables in bulk
- Download a ready-made CSV template

---

## Quick Start

### 1. Google Cloud Console setup

1. Go to https://console.cloud.google.com
2. Create or select a project
3. **Enable APIs**: search for "Tag Manager API" → Enable
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised JavaScript origins: `http://localhost:3000`
   - Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy the **Client ID** and **Client Secret**

### 2. Local setup

```bash
git clone <repo>
cd gtm-automation
npm install

# Create env file
cp .env.example .env.local
```

Edit `.env.local`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel Dashboard → Project → Settings → Environment Variables:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` → your production URL e.g. `https://gtm-studio.vercel.app`
- `NEXTAUTH_SECRET` → run `openssl rand -base64 32`

Then update your Google Cloud OAuth redirect URI to:
`https://your-domain.vercel.app/api/auth/callback/google`

## Deploy to Render

1. Connect your GitHub repo to Render
2. New Web Service → select repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add the same 4 environment variables above

---

## DataLayer Doc Format

Upload a CSV or XLSX with these columns (first row = header):

| Event Name | Variable Name | Variable Type | Scope | Description |
|---|---|---|---|---|
| purchase | transaction_id | dataLayer | hit | Unique order ID |
| purchase | revenue | dataLayer | hit | Total revenue value |
| add_to_cart | item_id | dataLayer | hit | Product SKU |

**Variable Type values:**
- `dataLayer` or `dlv` → creates a Data Layer Variable
- (future: `jsm`, `k` for JS Var and Cookie)

For each event row group, the tool creates:
1. A **Custom Event Trigger** → `CE - {eventName}`
2. **Data Layer Variables** for each variable row → `DLV - {variableName}`

---

## GTM API Scopes Used

| Scope | Reason |
|---|---|
| `tagmanager.readonly` | List accounts, containers, workspaces, audit data |
| `tagmanager.edit.containers` | Create tags, triggers, variables |
| `tagmanager.manage.accounts` | Account-level listing |

---

## Architecture

```
app/
  page.js                    # Login + app shell + context selector
  components/
    AuditView.js             # Audit mode UI + health score
    CreateView.js            # Manual + DataLayer upload UI
  api/
    auth/[...nextauth]/      # NextAuth Google OAuth handler
    gtm/route.js             # GTM API proxy (server-side, has access token)
lib/
  gtm.js                     # Server-side GTM API calls + audit engine
  gtmClient.js               # Client-safe helpers (CSV parser, payload builder)
```

All GTM API calls are proxied through `/api/gtm` — the Google access token never leaves the server.
