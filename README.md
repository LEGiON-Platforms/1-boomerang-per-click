# +1 Boomerang Per Click

A multiplayer web game in the style of the Roblox hit: click to throw boomerangs, every throw adds Power, Power breaks walls, walls pay Wins, Wins buy better boomerangs. Eight players share a room; the server owns the economy.

- **Client:** React 19 + Vite 8 + TypeScript, React Three Fiber / drei, Zustand, Tailwind, Colyseus SDK
- **Server:** Node + TypeScript, Colyseus 0.18 (`@colyseus/schema` 5), Express 5, MongoDB (or a JSON file in dev)
- **Monorepo:** `shared/` (config, rules, protocol), `server/`, `client/`, `tools/` (simulator, tuner, bot test, screenshots, perf probe)

## Run it

```bash
npm install
npm run dev          # game server on :2567 (watch mode) + Vite client on :5173
```

Open http://localhost:5173. Without `MONGO_URL` players are saved to `server/data/players.json`.

Client settings live in `client/.env` (copy `client/.env.example`): `VITE_GAME_SLUG` for Bloxity login, and `VITE_SERVER_URL` only when the client and server are hosted on different origins.

## Build and deploy

```bash
npm run build        # bundles server/dist and client/dist
npm start            # one Node process: game server + the built client on the same origin
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `2567` | HTTP + WebSocket port |
| `MONGO_URL` | — | MongoDB connection string; unset = JSON file store |
| `DATA_DIR` | `server/data` | JSON store location |
| `ALLOWED_ORIGINS` | localhost dev origins | CORS origins for the HTTP API |
| `CLIENT_DIST` | `client/dist` | Built client served by the game server |

Any Node 20+ host with WebSockets works (Render, Fly.io, Railway, a VPS). Put it behind HTTPS so the client connects over `wss://`.

## How the game plays

- **Lobby:** training pads with dummies (west; standing on a pad trains automatically, clicking adds more), the **Boomerang Stage** (east), the **Halloween Egg** at the front right of the stage gate, leaderboards, the rebirth statue, the trails stall, pumpkins to collect. The top-left of the screen is kept empty for the host's logo. There is no name screen: players join straight away under their Bloxity name (or an automatic one, changeable in Settings).
- **Players:** everyone appears as their real Bloxity avatar — outfit and proportions are relayed through the room. The nearest few are drawn in full (3 on LOW, 5 on MEDIUM, 7 on HIGH); players further away are simple blocky bodies.
- **Boomerangs:** 25, bought in order with Wins (Plastic costs 3 Wins … Godly 110M). The Boomerang Stage shows 20 at a time in two rows; step on the glowing pad of the next one to buy it (or use Shop → Boomerangs). Every boomerang has its own silhouette, pattern and colours, from the 3D model down to the shop icon.
- **Stages:** 30 stages of 10 walls (plastic, wood, concrete, brick, stone, marble, metals, gems, diamond, lava, ice, …), all played in the same corridor behind the lobby gate: each player sees the walls of *their own* current stage (per-player walls). Cracks spread across a wall as it takes damage. Past wall 10 the corridor opens into a reward room; the Wins pad (with a spinning trophy) is against the left wall. Claiming it sends trophies flying into the Wins counter and respawns you in the lobby — with the next stage's walls standing behind the gate. Settings → Stages jumps to any unlocked stage.
- **Shop:** everything costs Wins — boomerangs, trails, and the perks in the Boosts tab (Auto Win 2,000, 2x Power 25,000, 2x Wins 150,000, plus a 3-Win Starter Pack in a new player's first 10 minutes). The only other currency is pumpkins, for the Halloween Egg and its pets (Items tab: equip, merge 5 into a golden one). Daily rewards, gifts, quests and codes pay Wins scaled to your progress, pumpkins and boosts; a Lucky Block pays Wins and a boost, with a small chance of the VIP boomerang.
- **Rebirth:** gated by level — Rebirth 1 at level 15, 2 at level 30, 3 at level 45 (15 × n). It resets Power, Wins and stage progress and raises the Power multiplier. Level comes from lifetime Power and also makes you walk faster (+1% per level, up to +60%).
- **HUD:** left — Rebirths, Wins and Pumpkins, plus Shop (tabs: Boomerangs, Trails, Items, Boosts) and Rebirth. Top-right — Settings only (daily rewards, gifts, quests, codes, friends and stages are inside it). Bottom — Power, the level bar and four training-pad buttons. Click gains fly from the cursor (with a flame) into the Power counter; there is no notification panel, short messages float up instead.

## Economy and balance

All numbers live in `shared/src/config/` (nothing is hard-coded elsewhere). The boomerang table is a fixed design; the tuner balances around it by adjusting only wall HP growth and the XP curve.

```bash
npm run simulate                 # 30-hour run of a 5 clicks/s player through the real rules
npx tsx tools/tune.ts --keep-costs   # search wall HP + XP curve to hit the time targets
```

Current simulation (5 clicks/s, buys boomerangs, trails and the 2x Power / 2x Wins perks as soon as it can, rebirths as soon as the level allows):

| Target | Result |
|---|---|
| Stage 1 < 1 min | 8 s |
| Stage 5 in 8–12 min | 9 m 33 s |
| First rebirth in 15–25 min | 16 m 08 s (level 15) |
| Stage 10 ≈ 1 h | 1 h 02 m |
| Stage 20 in 6–8 h | 7 h 26 m |
| Stage 30 in 20–30 h | 23 h 34 m, 14 rebirths |

Wall HP grows by a factor that tapers from 21.9 (early stages) to 2.04 (late); a single constant can't hit both the early and the late targets. The XP curve tapers the same way so level 15 arrives at ~16 minutes while levels 30, 45, … stay reachable. The perk prices sit on the same curve: Auto Win around Stage 10, 2x Power around Stage 15, 2x Wins around Stage 20.

## Multiplayer and anti-cheat

Rooms of 8 (`joinOrCreate`, overflow opens a new room). The server runs every economy action through the same functions in `shared/src/logic/` the simulator uses, and validates input: a 12 throws/s token bucket, an 80 messages/s flood cap, movement speed (scaled by level) and walkable-area checks with rubber-banding, distance checks for the egg and pads, and corridor checks for wall damage. One live session per account (a new tab takes over the old one), 20 s reconnection window, autosave every 30 s.

## Performance

The game follows a strict budget (60 FPS, ≤ 80 draw calls and ≤ 100k triangles on low-end phones, textures ≤ 512 px there, ≤ 5 s to playable on 4G). Quality presets (LOW / MEDIUM / HIGH) are auto-detected and drop when FPS falls below 45; LOW has no shadows, particles or trails and lighter HUD effects. Repeated things are instanced (boomerangs — one draw call per silhouette —, pets, dummies, pumpkins, walls, corridor), projectiles and particles are pooled, nothing allocates inside the frame loop, menus and the stage corridor load lazily.

`npm run perf` (with the game server and a production build on `vite preview`) measures FPS, draw calls, triangles, texture memory and time to playable with 8 players in the room.

### Latest measurements

Production build, headless Edge on the development machine. Desktop numbers are with 8 players in the room; the phone runs were taken with the probe alone in the room, as the median of 3 runs. (The probe adds scripted players only with `--bots N`, and only on an isolated test server.)

| Budget | Mobile LOW (4× CPU throttle) | Desktop HIGH / MEDIUM |
|---|---|---|
| FPS ≥ 45 mobile, 60 desktop | ✅ idle 57–60 · ⚠️ while tapping 10/s: 28–30 on a loaded machine (see below) | ✅ 60 everywhere (lobby, stage, throwing) |
| Draw calls ≤ 80 / ≤ 150 | ✅ 33–36 | ✅ 57–58 |
| Triangles ≤ 100k / ≤ 300k | ✅ 30–32k | ✅ 80–102k |
| Max texture 512 / 1024 px | ✅ 512 px | ✅ 1024 px |
| GPU texture memory ≤ 64 / 128 MB | ✅ 5.4 MB | ✅ 18.8 MB |
| Initial load ≤ 5 / 10 MB | ✅ 523 KB transferred | ✅ same |
| GLB ≤ 1 / 2 MB | ✅ no GLBs shipped (the avatar is loaded from the Bloxity CDN) | ✅ |
| Rigid bodies ≤ 30 / 60 | ✅ 0 (kinematic controller, no physics engine) | ✅ |
| Time to playable ≤ 5 s on 4G | ⚠️ 6.3 s (Fast 4G) · 6.5 s (Slow 4G) on a loaded machine | — |

**Main-thread CPU, measured as thread time (not affected by other programs' load):** 2.4 ms per frame idle and 3.6 ms per frame while tapping 10 times a second, unthrottled. Even 4× slower — a low-end phone — that is 9.5 / 14.5 ms, inside the 16.7 ms frame budget. The FPS drops the probe reports while tapping come from waits on the GPU and compositor. They were measured with the machine at ~73% CPU load (other apps and a second browser running the game on the same GPU), so they need re-checking on an idle machine or a real phone. The two ⚠️ rows are the open risks.

Per-throw work is kept off the main thread where possible: HUD numbers refresh at most every 120 ms (200 ms on LOW); the level bar slides with `transform` (no layout or repaint); the flying "+X" elements are pooled and keep their compositor layers; on LOW, fast taps merge into one fly-up every 350 ms.

## Libraries (client bundle, gzip)

| Library | Size | Why |
|---|---|---|
| three | 203 KB | 3D engine |
| react + react-dom | 61 KB | UI |
| @react-three/fiber + drei (tree-shaken) | 60 KB | React renderer for three, `Html` labels, `PerformanceMonitor` |
| @colyseus/sdk (incl. schema, msgpackr) | 54 KB | multiplayer |
| zustand | ~1 KB | state |
| @fontsource/lilita-one | 11 KB woff2 | the chunky display font |
| r3f-perf | dev only | performance overlay (`?perf`), not in production builds |

Server only: `@colyseus/core`, `@colyseus/ws-transport`, `express`, `cors`, `mongoose`.

## Tools

| Command | What it does |
|---|---|
| `npx tsx tools/shot.ts --steps all [--mobile]` | Headless screenshots of every screen, against an isolated test client on :5176 (its own server on :2568, so tests never join real players' rooms) |
| `npm run perf` | Performance probe (see above) |
| `npm run simulate` / `tools/tune.ts` | Balance report / tuner |
