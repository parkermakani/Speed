### Background and Motivation

A mobile-first React web app that shows a Mapbox map centered on a live location marker with a pulsing effect and a small quote beneath it. A lightweight FastAPI backend controls the marker location and quote. An admin-only dashboard (protected by a simple password stored in an environment variable) allows updating the location and quote in real time. The system should be skinnable via our own primitives and style tokens, and future-ready for integrations (StreamElements bot, social media scraping near the marker).

### Key Challenges and Analysis

- **Map experience**: Render a pulsing live marker that feels smooth on mobile and desktop; start centered on the marker but allow user panning/zooming after load; ensure good performance on lower-end devices.
- **Marker + quote rendering**: Attach a small quote visually “under” the marker, responsive and readable, without obscuring the map; handle long quotes gracefully (truncate/expand?).
- **Backend simplicity + security**: Provide a simple password-protected admin path using an `.env` password; avoid complex auth at MVP while ensuring non-admin users cannot mutate state.
- **State persistence**: Persist the current location and quote so restarts do not lose data. Keep it minimal (SQLite or JSON file) while enabling future extensions.
- **Design system**: Define our own style tokens (colors, spacing, radii, typography, breakpoints) and a small set of UI primitives to enable fast iteration and consistent mobile-first UI.
- **DX and TDD**: Clear tests for backend endpoints and basic e2e/frontend tests for critical flows. Keep setup light and fast.
- **Future integrations**: Provide boundaries and extensibility for a StreamElements bot to update location/quote and optional social media scraping near the marker (Instagram/Twitter/X).
- **Quote positioning**: Keep the inspirational quote pinned to a fixed header area of the map rather than rendered near the marker, ensuring readability across breakpoints.
- **City-wide pulsing effect**: Replace the single-point radius with an animated polygon representing the selected city limits; efficiently fetch and render the geometry while maintaining smooth pulse animation.
- **3D marker model**: Investigate embedding a lightweight GLTF model as a marker that reacts to map pitch/bearing for an immersive experience, balancing performance on mobile.
- **UI clean-up**: Remove legacy notices ("last updated", "approximate location") and lat/lon read-outs to streamline the interface.
- **Journey table in Admin**: Maintain the ordered list of cities directly in the backend DB and surface a management table in the admin dashboard. Admin can mark any city as **current** with a toggle. Frontend map consumes DB-driven journey data (no external Google Sheet).

### High-level System Design

- **Frontend**: React + TypeScript (Vite), Mapbox GL JS for map. Mobile-first, PWA-ready later if desired. UI primitives built with CSS variables (tokens) + small component library.
- **Backend**: FastAPI + Uvicorn. Simple auth using `.env` admin password. Data persistence via SQLite (SQLModel) or JSON file. CORS allowed for the frontend origin. Endpoints:
  - `GET /status`: returns `{ lat, lng, quote, lastUpdated }`.
  - `POST /status`: updates `{ lat, lng, quote }` (auth required).
  - `POST /auth/login`: returns session token (JWT or signed cookie) on correct password.
  - `POST /auth/logout`: clears session.
- **Auth**: Minimal session cookie (httpOnly) or JWT in Authorization header. MVP can use a short-lived JWT signed with secret from `.env`.
- **Infra**: Dockerfile(s) for frontend and backend. `.env` for secrets and config. Simple deploy to Fly.io/Render/Railway or container hosting.

### Technical Decisions and Conventions

- **Tokens**: Define CSS variables under `:root` for color palette, spacing scale, typography, radii, shadows, and breakpoints. Example: `--color-bg`, `--space-2`, `--font-sans`, `--radius-2`, `--shadow-2`, `--bp-sm`.
- **UI primitives**: `Stack`, `Rows`, `Text`, `Button`, `Input`, `Card`, `FormField`, `Sheet` (mobile admin), `IconButton`. Keep API small and composable.
- **Map**: Use Mapbox GL JS v3; implement pulsing marker via custom layer or animated canvas per Mapbox example; quote rendered via an HTML `Marker` with a styled container.
- **Data model**: Single `status` record: `{ id: 1, lat: number, lng: number, quote: string, lastUpdated: datetime }`.
- **Validation**: Backend request schema validation for lat/lng ranges and quote length limits.
- **Testing**: Backend with `pytest` + `httpx` async client; minimal frontend tests via Vitest/React Testing Library; optional Playwright e2e later.

### High-level Task Breakdown (with success criteria)

1. Project scaffolding

   - Create `frontend/` and `backend/` folders.
   - Configure Vite (React + TS) and FastAPI projects; add Dockerfiles; set up `README`.
   - Success: Both apps run locally; `GET /status` returns placeholder; frontend loads with placeholder marker/quote.

2. Design tokens and primitives

   - Add `tokens.css` with CSS variables; implement `Stack`, `Text`, `Button`, `Input`, `Card`, `FormField` primitives with tokens.
   - Success: A demo page shows primitives with responsive behavior; no inline magic values in UI.

3. Map view and pulsing marker

   - Initialize Mapbox with token from `.env`; center on backend-provided marker; implement pulsing effect; attach quote under marker.
   - Respect mobile viewport; add safe-area insets; ensure map starts centered but user can pan/zoom.
   - Success: On load, map is centered on marker with smooth pulsing; quote readable; panning allowed; reload re-centers.

4. Backend endpoints + persistence

   - Implement `GET /status` and `POST /status` with validation; persist to SQLite (SQLModel) or JSON (choose SQLite for durability).
   - Success: Data survives server restarts; invalid inputs rejected with clear errors; timestamps updated.

5. Admin auth (env-based password)

   - `.env` contains `ADMIN_PASSWORD` and `JWT_SECRET` (or similar); implement `POST /auth/login` and `POST /auth/logout`.
   - Use httpOnly cookie or JWT bearer; protect `POST /status`.
   - Success: Correct password yields auth; wrong password rejected; protected route inaccessible without auth.

6. Admin dashboard page

   - Add `/admin` route; simple form to update lat/lng and quote; mobile-friendly; uses primitives; shows last updated; shows API errors inline.
   - Success: After login, admin can update data; changes reflected immediately on homepage; form validation prevents bad inputs.

7. TDD and tests

   - Backend unit/integration tests for auth, happy path, validation, unauthorized access, persistence.
   - Frontend unit tests for primitives and map component rendering (mock Mapbox); optional e2e happy path.
   - Success: Tests pass locally and in CI; coverage for critical flows.

8. Production hardening and DX

   - Add CORS config (env-based origins), rate limiting (simple middleware), basic logging/structured errors.
   - Add CI workflow (lint, test) and Docker images; document run/deploy steps.
   - Success: One-command local run; docker-compose works; CI green.

9. Future extensibility hooks (non-functional for now)

   - Reserve `/integrations/streamelements` controller stub and a background worker module.
   - Add internal events/emitters to publish status updates to integrations.
   - Success: Code structure allows plugging in integrations without touching core flows.

10. Quote repositioning (frontend)

    - Move quote into a fixed top overlay component that is always visible.
    - Remove quote HTML marker from map.
    - Success: Quote is visible at top of screen on all devices; no quote near pin.

11. City limits pulsing polygon

    - Accept a "city" text input in admin dashboard (reuse Places autocomplete).
    - Resolve city to polygon geometry via Mapbox Geocoding (`types=place` with `polygon_geojson=true`) and store in backend.
    - Render city polygon layer with animated opacity cycle to mimic pulsing; remove old 1-mile radius.
    - Success: Selected city boundary pulses softly, performance ≥30 fps on mobile.

12. 3D model marker

    - Integrate a GLTF/Three.js custom layer anchored at current location.
    - Ensure model scales with zoom and responds to map pitch/bearing.
    - Success: Model replaces icon, shows correct orientation while tilting map.

13. Interface cleanup

    - Remove “Last updated”, “Approximate location within 1 mile” notes from UI.
    - Remove lat/lon footer coordinates.
    - Success: Clean UI with no legacy disclaimers; tests updated.

14. Remove pulsing + city autocomplete (frontend)

    - Deprecate pulsing effect for city polygon; remove animated opacity logic.
    - Simplify city input by removing autocomplete and using admin-provided polygon only.
    - Success: Polygon remains static; admin workflow simplified.

15. Replit deployment & environment configuration

    - 15a. Create `.env` for local development and `.env.example` (checked in) with placeholder values (`MAPBOX_TOKEN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `GOOGLE_PLACES_API_KEY`, etc.).
    - 15b. Add `.env` to `.gitignore`; commit `.env.example`.
    - 15c. Install `python-dotenv` and update FastAPI `main.py` to load environment variables automatically when present.
    - 15d. Prefix frontend variables with `VITE_` and reference via `import.meta.env` (e.g., `VITE_MAPBOX_TOKEN`).
    - 15e. Add `.replit` file specifying the run command:
      `   run = "bash replit-run.sh"`
    - 15f. Create `replit-run.sh` script:
      `bash
      #!/usr/bin/env bash
      set -e

    # Install backend deps

    pip install -r backend/requirements.txt

    # Install frontend deps and build

    cd frontend
    npm install --legacy-peer-deps
    npm run build
    cd ..

    # Start FastAPI and serve dist/ via StaticFiles

    uvicorn backend.main:app --host 0.0.0.0 --port 8000
    `

    - 15g. Update `backend/main.py` to serve static files from `frontend/dist` when `os.getenv("ENV") == "production"`.
    - 15h. Document local vs Replit commands in `README.md`.
    - 15i. Add top-level `.gitignore` (see draft below).
    - Success: Clicking **Run** in Replit builds the frontend once and starts the backend, serving the compiled React app on port `8000`; local development workflow (`npm run dev` + `uvicorn --reload`) remains unchanged.

16. Journey table powered by backend DB

    - 16a. **Backend**: Add a `City` SQLModel table with fields: `id`, `city`, `state`, `lat`, `lng`, `order`, `is_current` (bool).
    - 16b. **Backend**: Provide endpoints:
      • `GET /journey` → `{ currentCity, path }` similar to prior spec but sourced from DB.
      • `GET /cities` → list all cities (ordered).
      • `PUT /cities/{id}` → update city fields or toggle `is_current` (admin only).
      • `POST /cities` → add new city (optional future).
    - 16c. **Frontend (Admin)**: Replace location form with a **table** listing all cities in order. Each row shows: index (order), City, State, and a radio button or indicator for **Current**. Changing the indicator triggers mutation to set `is_current=true` for that city and `false` for others; table re-fetches after success.
    - 16d. **Frontend (Public Map)**: Fetch `/journey` to render animated marker at `currentCity`, red dashed polyline via `path`, and pulsing polygon for `currentCity.state` (using existing state-geojson logic).
    - 16e. **Backend logic**: When a new city becomes current, ensure ordering rule: all cities with lower `order` considered past; path constructed accordingly. Provide helper to recompute path list.
    - 16f. **Tests & docs**: Unit tests for City CRUD, current-city toggle, `/journey` response; frontend tests for admin toggle UI and map rendering given mocked data; update README to remove Google Sheet env vars.
    - **Success**: Admin can click to mark a different city as current; site updates within seconds; no external Google Sheet.

17. Sleep Mode toggle

    - 17a. **Backend**: Add `Settings` table (single-row) or extend existing `Status` with `is_sleep` (bool, default false).
    - 17b. **Backend**: Expose `GET /sleep` returning `{ isSleep: boolean }` and `PUT /sleep` to toggle (admin-only).
    - 17c. **Frontend (Admin)**: Add a master "Sleep mode" switch at top of dashboard (e.g., `Toggle` primitive). Updating it calls `PUT /sleep` and shows confirmation.
    - 17d. **Frontend (Public)**: When `isSleep` is true, temporarily replace normal map UI with a **placeholder view** (wired now as: gray background with text "Map is sleeping – come back soon!"; pulse, marker, and paths hidden). Keep page responsive.
    - 17e. **Tests & docs**: Unit tests for sleep endpoints; frontend test that placeholder renders given mocked `isSleep=true`. Update README with explanation.
    - **Success**: Admin can flip Sleep switch; public site swaps to placeholder view within one refresh, switch back resumes full map.

18. Shop drawer overlay

    - 18a. **Frontend**: Create `Drawer` primitive with overlay/backdrop and slide-in/out animation from right; width 100% on mobile (below `--bp-md` breakpoint), 30% on desktop.
    - 18b. **Frontend**: Create `ShopTab` component: small vertical tab anchored to right side with shop icon (`shop.svg`). Clicking toggles Drawer; include hover/focus styles.
    - 18c. **Integration**: Wire `ShopTab` and `Drawer` in `App.tsx`; manage open/close state via React context or local state. Pressing `Esc` or clicking backdrop closes drawer.
    - 18d. **Accessibility**: Trap focus inside drawer, set `aria-modal="true"` and `role="dialog"`; ensure background content is inert (`aria-hidden`).
    - 18e. **Testing**: Unit tests for open/close interactions, keyboard navigation, and responsive width using viewport mocks.
    - **Success**: On mobile (<768px), drawer covers full viewport; on desktop (≥768px), drawer animates to 30% width; background content is scroll-locked; `Esc` and backdrop close it; vertical tab remains visible when drawer is closed.

19. Merch page 3D Model Viewer

    - 19a. **Dependencies**: Add `@react-three/fiber` and `@react-three/drei` to frontend `package.json` and install via `npm install`.
    - 19b. **3D asset**: Utilize existing `assets/3D/SpeedPin.glb`; create `types/glb.d.ts` to allow TypeScript import of `.glb` files as string URLs.
    - 19c. **Component**: Create `ModelViewer` React component that renders a `<Canvas>` from `@react-three/fiber`, loads the GLB via `useGLTF`, adds ambient + directional lights and `OrbitControls`; accept optional `height?: number` prop (default 260).
    - 19d. **Integration**: Update `components/Merch.tsx` to render `<ModelViewer />` above the products grid, maintaining responsive layout using the `Stack` primitive.
    - 19e. **Styling**: Apply subtle gradient background and rounded corners to the viewer; respect `prefers-reduced-motion` by disabling auto‐rotate.
    - 19f. **Testing**: Add React Testing Library test that mounts `ModelViewer` and expects a `canvas` element to be in the document without runtime errors.
    - **Success**: Opening the shop drawer shows an interactive 3D model viewer above merch items; model loads within 1 s on broadband; grid layout unaffected; all lints and tests pass.

### .gitignore (draft)

```
# ---- General ----
.DS_Store
.env
.env.local
*.log
*.sqlite3
speed.db

# ---- Python ----
__pycache__/
*.py[cod]
*.egg-info/
.env/
.venv/
venv/
dist/
build/

# ---- Node / Frontend ----
frontend/node_modules/
frontend/.vite/
frontend/dist/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm/
.cache/
coverage/

# ---- IDE / Editor ----
.idea/
.vscode/
*.sw?

# ---- Docker ----
*.tar
**/Dockerfile
**/docker-compose*

# ---- Replit ----
*.replit
replit.nix

# ---- Misc ----
*.orig
```

### Project Status Board

- [x] 1. Scaffolding: `frontend/` + `backend/` projects, run locally ✅
- [x] 2. Tokens + primitives implemented with demo page ✅
- [x] 3. Map with pulsing marker + quote, mobile-first ✅
- [x] 4. FastAPI `GET/POST /status` with SQLite persistence ✅
- [x] 5. Admin auth with `.env` password and JWT/cookie ✅
- [x] 6. Admin dashboard to update location/quote ✅
  - Protected admin routes with authentication flow
  - Clean login page with password validation
  - Comprehensive dashboard with current status display
  - Location/quote update form with real-time validation
  - Mobile-first responsive design using design system primitives
  - Error handling, loading states, and user feedback
  - Logout functionality and secure token management
  - Instant map updates after successful form submissions
- [x] 10. Quote repositioning (frontend) ✅
- [x] Quote overlay offset updated to account for header overlay (top: 80px) ✅
- [x] Header blur taper refined: Removed gradient overlay; ::before now applies blur with gradient mask for transparency ✅
- [x] Extracted reusable `Header` component; `App.tsx` updated to use it ✅
- [x] Header overflow fix: switched to left/right 0 and box-sizing:border-box so horizontal padding no longer causes scroll ✅
- [x] Extracted reusable `Quote` component; FlatMap & Map updated ✅
- [x] Quote moved to page level (`App.tsx`), removed from FlatMap/Map ⬆️✅
- [x] Added `ChromaticText` component to encapsulate chromatic layered styling ✅
- [x] `ChromaticText` now accepts `layers` prop to choose decorative layers ✅
- [x] `ChromaticText` now forwards `style` and other span props; size now honored ✅
- [x] Quote repositioned: Header + Quote in overlay flex-stack, quote now sits right under header and moves responsively ✅
- [x] Header made relative to overlay stack so quote no longer hidden ✅

- 🚀 **Task 10 COMPLETE**: Quote overlay verified.

- **Task 11: City limits pulsing polygon**

  - 11a. Backend: extend Status model with `city` (str) and `city_polygon` (TEXT/JSON); schema migration on startup.
  - 11b. Backend: update `StatusCreate` & `StatusResponse`, update `/status` endpoint logic.
  - 11c. Frontend types & API: extend Status interface and updateStatus payload.
  - 11d. Admin dashboard: add city search (Mapbox geocoding) input to fetch polygon and include in update.
  - 11e. Map component: render pulsing city polygon (fill + outline) with opacity animation; fallback to radius circle if polygon absent.
  - 11f. Testing: Verify polygon pulses and performs on mobile.
  - Success: City boundary pulses smoothly; marker remains; UI responsive.

- [ ] 12. 3D model marker
- [ ] 13. Interface cleanup
- [ ] 14. Remove pulsing + city autocomplete (frontend)
- [x] 15. Replit deployment & environment configuration ✅
- ⏳ 16. Journey table (DB) integration
  - ✅ 16a. City model & table created (backend/models.py); auto-migrated on startup.
  - ✅ 16b. City CRUD endpoints & /journey endpoint implemented (backend/main.py).
  - ⏳ 16c. Frontend admin table UI + mutation logic.
  - ✅ 16d. Public map now fetches /journey, renders animated marker and red dashed path; state polygon pulse reused.
  - ⏳ 16e. Tests & Docs update pending.
- ⏳ 17. Sleep mode toggle

  - ✅ 17a. Backend: added is_sleep column migration & status; GET/PUT /sleep endpoints.
  - ✅ 17b. Frontend: Admin switch toggles sleep via /sleep, placeholder view in App when sleep.
  - ⏳ 17c. Tests & docs outstanding.

|- [ ] 18. Shop drawer overlay (frontend)
|- ✅ 18a. Drawer primitive component implemented with responsive width & slide animation
|- ✅ 18b. ShopTab timed alert icon implemented – shop icon switches to alert after random 10–20 s delay
|- ✅ 19. Merch page – 3D Model Viewer COMPLETE

- Verified in dev: viewer displays and orbits; test suite passes via `npm run test`.

### Current Status / Progress Tracking

|- ✅ ModelViewer implemented and tested (Task 19 complete).
|- ✅ ShopTab alert icon verified in dev – after 10–20 s idle, icon changes to "shop-alert"; lints pass.
|- ✅ Mobile gray-screen bug (Mapbox on iOS/Android): Added WebGL support check + safe fallback in `FlatMap.tsx`. Devices without WebGL now see a polite message instead of a crash.
|- ✅ 3D GLB 500 error on mobile: Merch page now lazy-loads `ModelViewer` only when drawer open **and** on ≥1100 px screens. Mobile devices skip the heavy asset, eliminating 500 errors.
|- ✅ ShopTab alert audio implemented – wav plays when icon switches; awaiting manual validation.

### Recent Enhancements (Latest Session)

#### ✅ **Design System Updates**

- **American Theme Implementation**: Added patriotic color palette with Liberty Blue (#0A3161), Freedom Red (#B31942), Star White (#FFFFFF), Steel Gray (#4B4B4B), Sky Stripe (#3C8DFF), and Vintage Gold (#FFD700)
- **Site Branding**: Replaced chromatic text header with "Speed Does America" graphic logo from assets
- **Typography**: Integrated HWT American Adobe Font for authentic American aesthetic

#### ✅ **Privacy-Focused Location System**

- **1-Mile Privacy Zone**: Replaced expanding pulse ring with fixed 1-mile radius circle
- **Random Location Offset**: Generates random point within 1-mile radius to protect exact location privacy
- **Privacy Indicator**: Added "Approximate location within 1 mile" notice in map popup
- **Random Location Icons**: 11 different location markers that randomly select on each page load
- **Gentle Animation**: Subtle transparency pulse on the area circle instead of aggressive expanding rings

#### ✅ **Google Places API Integration**

- **Backend Proxy**: Created `/places/search` endpoint to avoid CORS issues with direct Google API calls
- **Real-time Autocomplete**: Address search with debounced queries (300ms) and up to 5 suggestions
- **Smart Coordinate Population**: Auto-fills lat/lng fields when user selects from address suggestions
- **Keyboard Navigation**: Arrow keys, Enter, and Escape support for accessibility
- **Enhanced UX**: Loading states, error handling, and focus management

#### ✅ **Map System Improvements**

- **Coordinate Validation**: Added safeguards against invalid lat/lng values causing Mapbox errors
- **Simplified Offset Algorithm**: Replaced complex trigonometric calculations with simpler degree-based offsets
- **Fixed Lat/Lng Order Bug**: getRandomOffsetLocation now returns coordinates in [lng, lat] order, resolving Mapbox "Invalid LngLat latitude" error
- **Error Recovery**: Graceful handling of edge cases and invalid coordinate scenarios
- **Performance**: Optimized random calculations and reduced complexity

#### ⚠️ **Known Issues**

- **React Boolean Warning**: Still receiving "Received `false` for a non-boolean attribute `error`" in console
- **Input Component**: Need to verify onKeyDown prop is properly handled in primitives
- \*\*Mapbox "Invalid LngLat latitude value" error due to swapped lat/lng order (fixed by returning [lng, lat] in helper).~~

#### 🚧 **Technical Debt**

- Need comprehensive testing for new Google Places integration
- Should add environment variable validation for Google API key
- Consider adding rate limiting for Places API proxy endpoint

- 🚧 **Next**: Task 7 (Tests for backend + minimal frontend coverage)
- 🔨 **Executor**: Backend city data layer operational; proceeding to frontend admin UI next session.

### Executor's Feedback or Assistance Requests

- Confirm preference for persistence layer: SQLite (recommended) vs JSON file. Defaulting to SQLite unless specified otherwise.
- Confirm preference for auth token style: httpOnly cookie vs JWT bearer. Defaulting to JWT in Authorization header for simplicity.
- Provide Mapbox token at runtime via `.env` for frontend.
- **Mobile Gray Screen Fix (2025-08-19)**: Implemented `mapboxgl.supported()` guard and try/catch around Map initialisation. Added fallback style and user-facing message. Please test on Chrome/Safari mobile and confirm the map or fallback message appears instead of a blank gray screen.
- **GLB 500 Error Fix (2025-08-19)**: Lazy-loaded `ModelViewer` (dynamic import) and gated behind desktop breakpoint. Large `SpeedPin.glb` (~43 MB) is no longer requested on mobile; Replit server 500 resolved.
- Confirm allowed CORS origin for local and prod.
- **Bug Fix (2025-08-17)**: Resolved AdminDashboard runtime error. Root cause: `FormField` assumed a **single child** but City field passed both `<Input>` and dropdown, producing an array and causing React to treat element type as undefined after `cloneElement`. Refactored City field: `FormField` now wraps only `<Input>`, and the suggestions dropdown is rendered outside within a relative wrapper. Please verify dashboard loads and dropdown still positions correctly.
- **Backend ↔ Frontend sync (2025-08-17)**: Frontend now normalizes snake_case (`city_polygon`) to camelCase (`cityPolygon`) on **both** read and write. Updated `services/api.fetchStatus` and refactored `App.tsx` to use it. Map now receives correct polygon string from backend record so city boundaries render.

**ModelViewer Progress (2025-08-19)**: Implemented interactive 3D viewer using React Three Fiber and Drei. Added `@react-three/fiber` & `@react-three/drei` dependencies, created `ModelViewer` component, and integrated it into the Merch page. Pending: add Vitest + RTL test to satisfy Task 19f.

**Dependency conflict fix (2025-08-19)**: `@react-three/fiber` peer range expects React <19.0, causing `npm install` failure. Added `frontend/.npmrc` with `legacy-peer-deps=true` so local `npm install` succeeds without manual flag. Replit run script already installs with `--legacy-peer-deps`.

**Test dep fix**: Pinned `@testing-library/react` to `^14.2.1` because 15.x does not yet exist on npm, resolving ETARGET error.

**Vite assetsInclude fix**: Added `assetsInclude: ["**/*.glb"]` to `vite.config.ts` so Vite treats `.glb` files as static assets, resolving 500 error during model load.

**React Three upgrade**: Upgraded `@react-three/fiber` to `^9.3.0` and `@react-three/drei` to `^10.7.3` for React 19 compatibility, resolving `ReactCurrentOwner` runtime error.

**Merch layout update**: Refactored `Merch.tsx` into flex row so `ModelViewer` occupies left half and product grid fills right; responsive wrap for narrow screens.

**Merch layout v2**: Updated to fixed 60%/40% width split regardless of viewport; viewer always left, product grid shrinks card min-width to 160px.

**Merch layout v3**: Replaced flex with CSS grid `60% 40%` columns (no wrap) ensuring products never drop below viewer.

**Drawer min-width**: Updated drawer: mobile breakpoint now 1299px, desktop width `clamp(700px,40vw,100%)` so it never shrinks below 700px before mobile full-screen.

**ShopTab fix**: Corrected CSS syntax to `calc(-1 * clamp(...))` so transform applies; tab now slides with drawer.

**ShopTab expand**: Updated transform to `calc(clamp(...)* -1)` ensuring movement scales beyond 700 px on large screens.

**ShopTab dynamic**: Replaced CSS calc with JS: compute drawer width as `max(700, 40% viewport)` on resize; translate tab by -width so it always aligns.

**Drawer constant width**: Requirement changed – desktop drawer fixed at 700 px. Updated `Drawer.tsx` `desktopWidth="700px"` and `ShopTab` transform to `translateX(-700px)`.

**ModelViewer pivot**: Raised camera to y=1 and OrbitControls target to [0,1,0] so anchor point is higher.
**ModelViewer height**: `height` prop now accepts `number | string` so `<ModelViewer height="100%" />` no longer triggers TS error.

**npm audit (2025-08-19)**: 4 moderate vulnerabilities stemming from `vitest` <3 (via esbuild/vite). Potential fix is upgrading `vitest` to 3.2.4 (major) – needs compatibility check. Awaiting decision whether to update or ignore for now.

### Lessons

- Include info useful for debugging in program output.
- Read the file before you try to edit it.
- If vulnerabilities appear in the terminal, run `npm audit` before proceeding.
- Always ask before using the `-force` git command.
