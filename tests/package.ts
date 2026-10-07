import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { globSync, readFileSync, statSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { test } from 'node:test'

/**
 * Static imports, re-exports and literal dynamic imports.
 *
 * 静态导入、重导出和字面量动态导入。
 */
const MODULE_SPECIFIER = /(?:\bfrom|\bimport\(?)\s*["']([^\s"']+)["']/g

const root = new URL('../', import.meta.url)
const manifest: { dependencies: Record<string, string> } = JSON.parse(
  readFileSync(new URL('package.json', root), 'utf8'),
)
const dependencies = Object.keys(manifest.dependencies)
const packed: { files: { path: string }[] }[] = JSON.parse(
  execSync('npm pack --dry-run --ignore-scripts --json', {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  }),
)
assert.equal(packed.length, 1)
const archive = packed[0]
assert.ok(archive)
const paths = archive.files.map((file) => file.path)

void test('the package contains every TypeScript source and only its package documents', () => {
  const sources = globSync('src/**/*.ts', { cwd: root }).map((path) => path.replaceAll('\\', '/'))
  for (const source of [
    'src/index.ts',
    ...['base', 'building', 'research', 'shipyard', 'fleet'].map(
      (name) => `src/example/${name}.ts`,
    ),
  ])
    assert.ok(sources.includes(source), `Missing script: ${source}`)
  assert.deepEqual(
    paths.toSorted(),
    ['LICENSE', 'README.md', 'package.json', ...sources].toSorted(),
  )
})

void test('published TypeScript sources resolve relative modules and use only declared dependencies or Node built-ins', () => {
  const published = new Set(paths.map((path) => new URL(path, root).href))
  for (const path of paths.filter((name) => name.startsWith('src/') && name.endsWith('.ts')))
    for (const match of readFileSync(new URL(path, root), 'utf8').matchAll(MODULE_SPECIFIER)) {
      const target = match[1]
      assert.ok(target)
      if (target.startsWith('.')) {
        const resolved = new URL(target, new URL(path, root))
        assert.ok(
          resolved.href.startsWith(root.href),
          `${path} imports outside the package: ${target}`,
        )
        assert.ok(published.has(resolved.href), `${path} imports an unpublished module: ${target}`)
        assert.ok(statSync(resolved).isFile(), `${path} cannot resolve ${target}`)
        continue
      }
      const declared = dependencies.some(
        (dependency) => target === dependency || target.startsWith(`${dependency}/`),
      )
      assert.ok(isBuiltin(target) || declared, `${path} imports ${target}`)
    }
})
