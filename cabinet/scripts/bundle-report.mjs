import { readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(join(root, 'dist/.vite/manifest.json'), 'utf8'))
function staticClosure(roots) {
  const visited = new Set()
  function visit(key) {
    if (visited.has(key)) return
    if (!manifest[key]) throw new Error(`Missing build entry: ${key}`)
    visited.add(key)
    for (const dependency of manifest[key].imports ?? []) visit(dependency)
  }
  roots.forEach(visit)
  return [...visited]
}
// Rollup may name a shared dynamic store with a generated key instead of its source path.
const storeEntries = Object.entries(manifest).filter(([key, entry]) => key === 'src/mocks/store.ts' || /^assets\/store-[^/]+\.js$/.test(entry.file))
if (storeEntries.length !== 1) throw new Error('Expected exactly one demo state store chunk')
const initial = staticClosure(['index.html', 'src/features/dashboard.tsx', storeEntries[0][0]])
const initialJS = [...new Set(initial.map((key) => manifest[key].file))].filter((file) =>
  file.endsWith('.js'),
)
const initialCSS = [...new Set(initial.flatMap((key) => manifest[key].css ?? []))]
const fonts = [...new Set(initial.flatMap((key) => manifest[key].assets ?? []))].filter((file) =>
  file.endsWith('.woff2'),
)
async function compressed(files) {
  return (
    await Promise.all(
      files.map(async (file) => gzipSync(await readFile(join(root, 'dist', file))).byteLength),
    )
  ).reduce((sum, n) => sum + n, 0)
}
const chartExtra = staticClosure(['src/components/xp-chart.tsx'])
  .filter((key) => !initial.includes(key))
  .map((key) => manifest[key].file)
const report = {
  method:
    'Local gzip byte lengths from the Vite manifest; static imports counted once. These are build budgets, not network timings or Core Web Vitals.',
  initialJavaScriptGzipBytes: await compressed(initialJS),
  initialCSSGzipBytes: await compressed(initialCSS),
  detailedChartAdditionalGzipBytes: await compressed(chartExtra),
  allReferencedWoff2Bytes: (
    await Promise.all(fonts.map(async (file) => (await stat(join(root, 'dist', file))).size))
  ).reduce((sum, n) => sum + n, 0),
  initialJavaScriptFiles: initialJS,
  overviewBudgetBytes: 200000,
}
report.overviewBudgetPassed = report.initialJavaScriptGzipBytes <= report.overviewBudgetBytes
await mkdir(join(root, 'verification'), { recursive: true })
await writeFile(
  join(root, 'verification/bundle-report.json'),
  JSON.stringify(report, null, 2) + '\n',
)
console.log(JSON.stringify(report, null, 2))
if (!report.overviewBudgetPassed) process.exitCode = 1
