import { Worker } from 'node:worker_threads'

export type Reply = {
  status?: number
  body?: string
  headers?: Record<string, string>
}

export type RecordedRequest = {
  url: URL
  method: string
  body: URLSearchParams | null
}

export type ScriptResult = {
  stdout: string
  stderr: string
  exitCode: NodeJS.Process['exitCode']
  requests: RecordedRequest[]
  delays: number[]
  waitSnapshots: number[]
}

type ScriptOptions = {
  rounds?: number
}

export type ScriptConfiguration = ScriptOptions & {
  name: string
  replies: (Reply | Error)[]
}

export type SerializedScriptResult = Omit<ScriptResult, 'requests'> & {
  requests: {
    url: string
    method: string
    body: [string, string][] | null
  }[]
}

function readResult(value: SerializedScriptResult): ScriptResult {
  return {
    ...value,
    requests: value.requests.map((request) => ({
      url: new URL(request.url),
      method: request.method,
      body: request.body === null ? null : new URLSearchParams(request.body),
    })),
  }
}

/**
 * A fresh worker reruns top-level modules without the ESM cache and keeps their original URL so native coverage combines scenarios.
 *
 * 每个场景使用独立线程重新执行顶层模块，隔离 ESM 缓存，同时保留原始 URL 供原生覆盖率合并场景。
 */
export async function runScript(
  name: string,
  replies: (Reply | Error)[],
  options: ScriptOptions = {},
): Promise<ScriptResult> {
  const configuration: ScriptConfiguration = { name, replies, ...options }
  const worker = new Worker(new URL('./fixtures/script-worker.ts', import.meta.url), {
    workerData: configuration,
  })
  let deadline: NodeJS.Timeout | undefined
  try {
    return await new Promise<ScriptResult>((resolve, reject) => {
      let result: ScriptResult | undefined
      deadline = setTimeout(() => reject(new Error(`Script ${name} exceeded 10 seconds`)), 10_000)
      worker.once('message', (message: SerializedScriptResult) => {
        try {
          result = readResult(message)
        } catch (error) {
          reject(error)
        }
      })
      worker.once('error', reject)
      worker.once('exit', (code) => {
        if (code !== 0) reject(new Error(`Script worker exited with code ${code}`))
        else if (result === undefined) reject(new Error('Script worker returned no result'))
        else resolve(result)
      })
    })
  } finally {
    clearTimeout(deadline)
    await worker.terminate()
  }
}

export function loginReply(): Reply {
  return {
    status: 302,
    headers: { Location: './game.php', 'Set-Cookie': '2Moons=confirmed; path=/' },
  }
}

export function pageReply(body: string): Reply {
  return { body, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
}

/**
 * Supply the game document shell and the server-selected planet for real response parsing.
 *
 * 提供游戏文档外壳及服务端选中的星球，交由真实响应解析器读取。
 */
export function gamePage(content: string, planetId = 101): string {
  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Game</title></head><body>',
    `<span class="active_urlpalnet" url="cp=${planetId}"></span>`,
    '<div class="active_panet"><div class="name_palnet">Homeworld</div>',
    '<div class="coordinates_palnet">[1:2:3]</div></div>',
    `<div id="content"><div id="ally_content">${content}</div></div>`,
    '</body></html>',
  ].join('')
}
