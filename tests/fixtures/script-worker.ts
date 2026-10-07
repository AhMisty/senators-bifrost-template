import assert from 'node:assert/strict'
import { syncBuiltinESMExports } from 'node:module'
import { mock } from 'node:test'
import timers from 'node:timers/promises'
import { parentPort, workerData } from 'node:worker_threads'

import type { RecordedRequest, ScriptConfiguration, SerializedScriptResult } from '../helpers.ts'

const configuration: ScriptConfiguration = workerData
const { replies, rounds } = configuration
assert.ok(parentPort)

const requests: RecordedRequest[] = []
const delays: number[] = []
const waitSnapshots: number[] = []
const settledSnapshots: number[] = []
let stdout = ''
let stderr = ''

const transport: typeof globalThis.fetch = async (input, init = {}) => {
  assert.ok(input instanceof URL, 'scripts send URL requests through Bifrost')
  requests.push({
    url: new URL(input),
    method: init.method ?? 'GET',
    body: init.body instanceof URLSearchParams ? new URLSearchParams(init.body) : null,
  })
  const reply = replies[requests.length - 1]
  assert.ok(reply !== undefined, `unexpected request: ${input.href}`)
  if (reply instanceof Error) throw reply
  return new Response(reply.body ?? null, {
    status: reply.status ?? 200,
    headers: reply.headers ?? {},
  })
}
mock.method(globalThis, 'fetch', transport)
mock.method(process.stdout, 'write', (chunk: string | Uint8Array) => {
  stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
  return true
})
mock.method(process.stderr, 'write', (chunk: string | Uint8Array) => {
  stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString()
  return true
})

if (rounds !== undefined) {
  mock.method(timers, 'setTimeout', async (delay: number) => {
    delays.push(delay)
    const requestCount = requests.length
    waitSnapshots.push(requestCount)
    /**
     * Yield one event-loop turn while the delay is unresolved to observe requests that start before the wait completes.
     *
     * 延时尚未完成时让出一轮事件循环，以观察是否有请求在等待结束前启动。
     */
    await timers.setImmediate()
    settledSnapshots.push(requests.length)
    if (delays.length >= rounds) throw new Error('Stop the finite test run')
  })
  syncBuiltinESMExports()
}

try {
  const path =
    configuration.name === 'index'
      ? '../../src/index.ts'
      : `../../src/example/${configuration.name}.ts`
  await import(new URL(path, import.meta.url).href)
  assert.equal(requests.length, replies.length, 'every configured response is consumed')
  assert.deepEqual(settledSnapshots, waitSnapshots, 'dispatch waits for the previous round delay')
  const result: SerializedScriptResult = {
    stdout,
    stderr,
    exitCode: process.exitCode,
    requests: requests.map((request) => ({
      url: request.url.href,
      method: request.method,
      body: request.body === null ? null : [...request.body],
    })),
    delays,
    waitSnapshots,
  }
  parentPort.postMessage(result, [])
} finally {
  mock.restoreAll()
  syncBuiltinESMExports()
  process.exitCode = undefined
}
