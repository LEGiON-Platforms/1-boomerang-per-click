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

Open http://localhost:5173. Without `MONGODB_URI` (or `MONGO_URL`) players are saved to `server/data/players.json`.

Client settings live in `client/.env.local` (see `client/.env.example`): `VITE_GAME_SLUG` (defaults to the game id, `1-boomerang-per-click`), and `VITE_SERVER_URL` only when the client and server are hosted on different origins.

## Build and deploy

```bash
npm run build        # bundles server/dist and client/dist
npm start            # one Node process: game server + the built client on the same origin
```

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `2567` | HTTP + WebSocket port |
| `MONGODB_URI` (or `MONGO_URL`) | — | MongoDB connection string; unset = JSON file store |
| `DATA_DIR` | `server/data` | JSON store location |
| `ALLOWED_ORIGINS` | localhost dev origins | CORS origins for the HTTP API (the game's `*.play.bloxity.io` sites and `CLIENT_ORIGIN` are always allowed) |
| `CLIENT_ORIGIN` | — | Extra CORS origin (Legion sets it to the game site) |
| `CLIENT_DIST` | `client/dist` | Built client served by the game server |
| `BLOXITY_GAME_ID`, `BLOXITY_CHANNEL`, `POD_NAME` | — | Set by Legion; shown in the startup log |

`GET /health` answers 200 straight away (hosting probes). On SIGTERM / SIGINT the server stops taking joins, saves every player and exits; clients rejoin on their own.

Any Node 20+ host with WebSockets works (Render, Fly.io, Railway, a VPS). Put it behind HTTPS so the client connects over `wss://`.

## Hosting on Bloxity Legion

The game runs on Bloxity Legion as game id **`1-boomerang-per-click`**:

| | Play (web client) | Backend (HTTP only) |
|---|---|---|
| prod (`main`) | https://1-boomerang-per-click.play.bloxity.io | https://1-boomerang-per-click.host.bloxity.io |
| dev (`dev`) | https://1-boomerang-per-click.dev.play.bloxity.io | https://1-boomerang-per-click.dev.host.bloxity.io |

Every push to `dev` (dev channel) or `main` (prod channel) runs `.github/workflows/deploy.yml`:

1. **Game server:** builds `server/Dockerfile` (Node 22 Alpine, non-root, the esbuild bundle plus production dependencies), pushes it to `ghcr.io/<owner>/1-boomerang-per-click-server:<channel>-<sha>` and asks Legion to roll it out with `seatCap: 8` (the room's `maxClients`, `MAX_CLIENTS` in `shared/src/protocol.ts` — change both together). Legion injects `PORT`, `MONGODB_URI` (the game's own managed database), `CLIENT_ORIGIN`, `JWT_SECRET` and the game/channel/pod names. Deploys drain: the old server saves everyone and closes its rooms with `SERVER_SHUTDOWN`, and each client rejoins at once on the new one.
2. **Web client:** builds `client/` with `VITE_LEGION_GAME_ID` set, zips `client/dist` and uploads it as the channel's frontend. With that variable the client joins through the matchmaker (`Legion.SDK.net.resolveEndpoint`, from the SDK script `index.html` already loads — about 35 KB gzipped, not bundled) and makes a new Colyseus `Client` for every endpoint; failed joins back off (1–8 s) and give up after a minute. Local dev (no `VITE_LEGION_GAME_ID`) still connects straight to the server.
3. **Stage (optional):** with a `LEGION_DEPLOY_TOKEN_STAGE` secret the same image and build also go to the stage platform in separate jobs (the stage API hosts in the workflow's `env` are assumed — check them against Bloxity's Environments docs).

Manual steps (once):

1. GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**: name `LEGION_DEPLOY_TOKEN`, value = the deploy token from My Games (never commit it).
2. Push to `dev`. When the first run has pushed the image: GitHub → your profile → **Packages → 1-boomerang-per-click-server → Package settings → Change visibility → Public**, then re-run the workflow (Actions → the run → Re-run all jobs) so Legion can pull it.
3. Push (or merge) to `main` for prod.

## How the game plays

- **Lobby:** training pads with dummies (west; standing on a pad you own trains automatically, clicking adds more — pads are bought with Wins, see below), the **Boomerang Stage** (east), the **Halloween Egg** at the front right of the stage gate, leaderboards, the rebirth statue, the trails stall, pumpkins to collect. The top-left of the screen is kept empty for the host's logo. There is no name screen: players join straight away under their Bloxity name (or an automatic one, changeable in Settings).
- **Players:** everyone appears as their real Bloxity avatar — outfit and proportions are relayed through the room. Every player in the room (up to 7 others) is drawn as their Bloxity avatar at any distance; far-away avatars just update their pose less often (every 2nd frame past 30 m, every 4th past 60 m) to save CPU. Standing still, a player takes a ready stance: feet apart, knees bent, the free arm forward and the boomerang arm back.
- **Throwing:** the boomerang in your hand is the one that flies. It leaves the hand as the arm whips forward, the hand stays empty while it's out, and as it comes back the arm reaches out and catches it. With several in the air at once, each new throw pulls one more into the hand for its wind-up.
- **Boomerangs:** 25, bought in order with Wins (Plastic costs 3 Wins … Godly 110M). The Boomerang Stage shows 20 at a time in two rows; step on the glowing pad of the next one to buy it (or use Shop → Boomerangs). Every boomerang has its own silhouette, pattern and colours, from the 3D model down to the shop icon.
- **Stages:** 30 stages of 10 walls (plastic, wood, concrete, brick, stone, marble, metals, gems, diamond, lava, ice, …) laid out in one line behind the lobby gate: stage 1, then stage 2, and so on. Each player sees their own walls (per-player walls). Cracks spread across a wall as it takes damage; when it breaks it shatters into chunks of its own material that burst away from the impact, tumble and crumble to the floor. Breaking a stage's 10th wall unlocks the next stage and opens the gate at the end of its reward room, so you can walk straight on into it. The reward room's Wins pad (with a spinning trophy) is against the left wall; claiming it sends trophies flying into the Wins counter and respawns you in the lobby, where every wall stands again. Settings → Stages jumps to any unlocked stage.
- **Shop:** everything costs Wins — boomerangs, trails, and the perks in the Boosts tab (Auto Win 2,000, 2x Power 25,000, 2x Wins 150,000, plus a 3-Win Starter Pack in a new player's first 10 minutes). The only other currency is pumpkins, for the Halloween Egg and its pets (Items tab: equip, merge 5 into a golden one). Daily rewards, gifts, quests and codes pay Wins scaled to your progress, pumpkins and boosts; a Lucky Block pays Wins and a boost, with a small chance of the VIP boomerang.
- **Trails:** 12 trails in the Shop (Wins), each multiplying Power and each with its own glowing look — Wind Wisp, Bubbles, Electric Zap, Wave, Comet, Double Helix, Sparkles, Flames, Aurora, Nebula Cloud, Rainbow, Cosmic Helix. The equipped trail glows along every thrown boomerang's path out and back (with an aura round the boomerang) and behind you as you walk — a ribbon plus a glowing path on the floor — fading over about 2 seconds; the walking trail grows wider and brighter with your level. Boomerangs make a spinning "whup-whup" whoosh as they fly.
- **Rebirth:** gated by level — Rebirth 1 at level 15, 2 at level 30, 3 at level 45 (15 × n). It resets Power, Wins and stage progress and raises the Power multiplier. Level comes from lifetime Power and also makes you walk faster, quickly at first: +18% at level 5, +50% at 15, +77% at 30, easing towards double speed (the level-up message shows the bonus).
- **HUD:** left — Rebirths, Wins and Pumpkins, plus Shop (tabs: Boomerangs, Trails, Items, Boosts) and Rebirth. Top-right — Settings only (daily rewards, gifts, quests, codes, friends and stages are inside it). Bottom — Power, the level bar and four training-pad buttons (tap an owned pad to jump onto it; the next pad shows its price in Wins and is bought with a tap). Click gains fly from the cursor (with a flame) into the Power counter; there is no notification panel, short messages float up instead.

## Economy and balance

All numbers live in `shared/src/config/` (nothing is hard-coded elsewhere). The boomerang table is a fixed design; the tuner balances around it by adjusting only wall HP growth and the XP curve.

```bash
npm run simulate                 # 30-hour run of a 5 clicks/s player through the real rules
npx tsx tools/tune.ts --keep-costs   # search wall HP + XP curve to hit the time targets
```

**Training pads** are bought in order with Wins and kept through rebirths (older saves keep the pads their rebirths had unlocked). Prices are set so each pad arrives about when it used to unlock by rebirth:

| Pad | Power | Cost (Wins) | Simulated purchase |
|---|---|---|---|
| 1 | x1.25 | free | — |
| 2 | x1.5 | 600 | 21 m (after rebirth 1) |
| 3 | x2 | 18K | 1 h 29 m (rebirth 2) |
| 4 | x4 | 400K | 6 h 40 m (rebirth 4) |
| 5 | x8 | 7M | 14 h 08 m (rebirth 8) |
| 6 | x16 | 25M | 19 h 07 m (rebirth 11) |
| 7 | x75 | 1B | late game |

Current simulation (5 clicks/s, buys training pads, boomerangs, trails and the 2x Power / 2x Wins perks as soon as it can, rebirths as soon as the level allows):

| Target | Result |
|---|---|
| Stage 1 < 1 min | 8 s |
| Stage 5 in 8–12 min | 9 m 33 s |
| First rebirth in 15–25 min | 16 m 08 s (level 15) |
| Stage 10 ≈ 1 h | 1 h 04 m |
| Stage 20 in 6–8 h | 7 h 29 m |
| Stage 30 in 20–30 h | 24 h 05 m, 14 rebirths |

Wall HP grows by a factor that tapers from 21.9 (early stages) to 2.04 (late); a single constant can't hit both the early and the late targets. The XP curve tapers the same way so level 15 arrives at ~16 minutes while levels 30, 45, … stay reachable. The perk prices sit on the same curve: Auto Win around Stage 10, 2x Power around Stage 15, 2x Wins around Stage 20.

## Multiplayer and anti-cheat

Rooms of 8 (`joinOrCreate`, overflow opens a new room). The server runs every economy action through the same functions in `shared/src/logic/` the simulator uses, and validates input: a 12 throws/s token bucket, an 80 messages/s flood cap, movement speed (scaled by level) and walkable-area checks with rubber-banding, distance checks for the egg and pads, and corridor checks for wall damage. One live session per account: a new tab or a refresh takes over at once, and the old avatar disappears right away instead of waiting out the 20 s reconnection window. Progress (Power, level, Wins, everything) is saved every 30 s, soon after purchases and when you leave, under the browser's guest id — come back days later in the same browser and you carry on where you stopped.

## Performance

The game follows a strict budget (60 FPS, ≤ 80 draw calls and ≤ 100k triangles on low-end phones, textures ≤ 512 px there, ≤ 5 s to playable on 4G). Quality presets (LOW / MEDIUM / HIGH): the game starts on LOW; picking Auto in Settings detects the device and drops a preset when FPS falls below 45; LOW has no shadows or particles, only your own walking trail (others' show from MEDIUM) and lighter HUD effects. All trails — every boomerang's glowing path, auras, sparkles and walking trails — are written into one dynamic geometry: one draw call (LOW drops the sparkle and bubble bits). A breaking wall's chunks are animated entirely in the vertex shader from one time uniform: one draw call while it lasts, no per-frame CPU work. Signs and boards are drawn on as many 512² pages (1024² above LOW) as they need, so their text stays sharp on every preset. Repeated things are instanced (boomerangs — one draw call per silhouette —, pets, dummies, pumpkins, walls, corridor), projectiles and particles are pooled, nothing allocates inside the frame loop, menus and the stage corridor load lazily.

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
