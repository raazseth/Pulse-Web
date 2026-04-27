# Pulse HUD — Client

Real-time heads-up display for live qualitative research interviews. Streams live transcript, surfaces AI-generated prompt suggestions, tracks tags, signals, and session context in a single React interface.

---

## Tech stack

- **React 19** + **TypeScript** (strict)
- **Vite 8** bundler, **vitest** test runner
- **MUI v9** component library
- **IndexedDB** for local session persistence
- **WebSocket** real-time transcript stream
- **PWA** (vite-plugin-pwa, offline-capable)

---

## Project setup

### Prerequisites

- Node.js 22+
- npm 10+

### Install dependencies

```bash
npm ci
```

### Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

`.env.example`:

```env
# REST API base URL (no trailing slash)
VITE_HUD_API_URL=http://localhost:3000/api/v1

# WebSocket URL for the real-time transcript stream
VITE_TRANSCRIPT_WS_URL=ws://localhost:3000/ws/transcript
```

For production, point both vars at your deployed server:

```env
VITE_HUD_API_URL=https://api.your-domain.com/api/v1
VITE_TRANSCRIPT_WS_URL=wss://api.your-domain.com/ws/transcript
```

> Vite embeds `VITE_*` variables **at build time**. Set them in your CI/CD environment or Vercel dashboard before building — they cannot be changed at runtime.

### Run locally

```bash
npm run dev
```

App runs at `http://localhost:5173` by default.

### Run tests

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Preview the production build locally:

```bash
npm run preview
```

---

## Deployment

### Vercel (recommended)

#### Option A — Connect a Git repository (automatic deploys)

1. Push your code to GitHub, GitLab, or Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel auto-detects Vite. Confirm the settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Root directory**: `client` *(if the repo root is the monorepo root)*
4. Add environment variables under **Settings → Environment Variables**:

   | Name | Value |
   |---|---|
   | `VITE_HUD_API_URL` | `https://api.your-domain.com/api/v1` |
   | `VITE_TRANSCRIPT_WS_URL` | `wss://api.your-domain.com/ws/transcript` |

5. Click **Deploy**. Every push to `main` triggers a new production deploy automatically.

#### Option B — Deploy from the CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

The CLI prompts you to link a project and configure env vars interactively.

#### SPA routing

`vercel.json` (already committed) configures the `/*` rewrite to `index.html` so client-side routes like `/login` work after a hard reload.

#### Security headers

`vercel.json` also sets:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: microphone=(self)` — required for the mic capture feature
- `Cache-Control: immutable` on `/assets/*` (hashed filenames, safe to cache forever)

---

### Docker (local or cloud)

Build and run the container:

```bash
docker build \
  --build-arg VITE_HUD_API_URL=https://api.your-domain.com/api/v1 \
  --build-arg VITE_TRANSCRIPT_WS_URL=wss://api.your-domain.com/ws/transcript \
  -t pulse-hud-client .

docker run -p 8080:80 pulse-hud-client
```

App is served on `http://localhost:8080` via nginx.

The image uses a **two-stage build** (Node 22 alpine to build, nginx 1.27 alpine to serve) and stays under ~25 MB.

---

## Project structure

```
src/
├── app/               # Router, providers, ErrorBoundary
├── layouts/           # DashboardLayout
├── modules/
│   ├── auth/          # Login, AuthProvider, token management
│   ├── context/       # Session store (metadata, notes, tags)
│   ├── prompts/       # AI prompt suggestions
│   ├── tagging/       # Tag panel + keyboard shortcuts
│   ├── timeline/      # Event timeline markers
│   └── transcript/    # WebSocket stream, mic capture, transcript UI
└── shared/
    ├── constants/     # DESKTOP_SENTINEL and other shared literals
    ├── services/      # IndexedDB session persistence
    ├── types/         # Shared TypeScript types
    └── utils/         # fetchWithAuth, hudApi, formatters
```

---

## Key environment notes

| Variable | Required | Default (dev) | Notes |
|---|---|---|---|
| `VITE_HUD_API_URL` | Yes | `http://localhost:3000/api/v1` | REST API base |
| `VITE_TRANSCRIPT_WS_URL` | Yes | `ws://localhost:3000/ws/transcript` | WebSocket endpoint |

Both variables default to `localhost:3000` when absent, so the app builds and runs in development without a `.env` file. **Production deployments must set them explicitly** — there is no runtime fallback to a production URL.

---

## Security notes

- Access tokens are kept in **React state only** (never persisted to storage).
- Refresh tokens are stored in **`sessionStorage`** (cleared on tab close). Long-term goal: migrate to `httpOnly` cookies (requires server coordination).
- No secrets, API keys, or credentials should ever be committed. The `.gitignore` excludes all `.env*` files except `.env.example`.
