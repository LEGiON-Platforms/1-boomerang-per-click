// Runs the game server (watch mode) and the Vite client together: `npm run dev`.
// Ctrl+C stops both.
import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'
const procs = [
  ['server', ['run', 'dev', '-w', 'server']],
  ['client', ['run', 'dev', '-w', 'client']],
].map(([name, args]) => {
  const child = spawn(isWin ? 'npm.cmd' : 'npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: isWin })
  const prefix = name === 'server' ? '\x1b[35m[server]\x1b[0m ' : '\x1b[36m[client]\x1b[0m '
  const pipe = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) if (line) out.write(prefix + line + '\n')
    })
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    console.log(`${prefix}exited with code ${code}`)
    shutdown()
  })
  return child
})

let stopping = false
function shutdown() {
  if (stopping) return
  stopping = true
  for (const p of procs) if (!p.killed) p.kill()
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
