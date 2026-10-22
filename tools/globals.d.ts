// Hooks the client exposes for the probes (see client/src/game/GameCanvas.tsx).
export {}

declare global {
  interface Window {
    __bpcRenderInfo?: () => { calls: number; triangles: number; textures: number; geometries: number; programs: number }
    __bpcTextureStats?: () => { count: number; bytes: number; largest: number }
  }
}
