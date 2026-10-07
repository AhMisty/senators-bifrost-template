import assert from 'node:assert/strict'
import { test } from 'node:test'

import { constructionBody, shipyardBody } from './fixtures/construction.ts'
import type { RecordedRequest, Reply, ScriptResult } from './helpers.ts'
import { gamePage, loginReply, pageReply, runScript } from './helpers.ts'

function expectSuccess(result: ScriptResult, stdout: string): void {
  assert.equal(result.stdout, stdout)
  assert.equal(result.stderr, '')
  assert.equal(result.exitCode, undefined)
}

function expectFailure(result: ScriptResult, code: string): void {
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, `Script failed (${code})\n`)
  assert.equal(result.exitCode, 1)
}

function requestAt(result: ScriptResult, index: number): RecordedRequest {
  const request = result.requests[index]
  assert.ok(request, `expected request ${index}`)
  return request
}

function expectLogin(result: ScriptResult): void {
  const request = requestAt(result, 0)
  assert.equal(request.url.href, 'https://your-server.example/game/index.php?page=login&uni=1')
  assert.equal(request.method, 'POST')
  assert.deepEqual(
    [...(request.body ?? [])],
    [
      ['username', 'pilot'],
      ['password', 'secret'],
    ],
  )
}

function expectPage(result: ScriptResult, page: string, index = 1): void {
  const request = requestAt(result, index)
  assert.equal(request.url.href, `https://your-server.example/game/game.php?page=${page}&cp=101`)
  assert.equal(request.method, 'GET')
  assert.equal(request.body, null)
}

void test('the empty entry point performs no operation', async () => {
  expectSuccess(await runScript('index', []), '')
})

void test('base logs in and prints observed building fields', async () => {
  const result = await runScript('base', [
    loginReply(),
    pageReply(gamePage(constructionBody({ levels: [{ elementId: 1, level: 9 }] }))),
  ])
  expectSuccess(result, 'Planet 101: building 1 level 9, free fields 151\n')
  expectLogin(result)
  expectPage(result, 'buildings')
})

void test('base reports an omitted building level as unknown', async () => {
  const result = await runScript('base', [
    loginReply(),
    pageReply(gamePage(constructionBody({ levels: [{ elementId: 2, level: 4 }] }))),
  ])
  expectSuccess(result, 'Planet 101: building 1 level unknown, free fields 151\n')
})

const operations = [
  {
    name: 'building',
    page: 'buildings',
    body: constructionBody({ levels: [{ elementId: 1, level: 9 }] }),
    confirmed: constructionBody({ levels: [{ elementId: 1, level: 10 }] }),
    missing: constructionBody({ levels: [{ elementId: 2, level: 4 }] }),
    before: { level: 9, queued: false },
  },
  {
    name: 'research',
    page: 'research',
    body: constructionBody({ levels: [{ elementId: 113, level: 4 }] }),
    confirmed: constructionBody({ levels: [{ elementId: 113, level: 5 }] }),
    missing: constructionBody({ levels: [{ elementId: 2, level: 4 }] }),
    before: { level: 4, queued: false },
  },
  {
    name: 'shipyard',
    page: 'shipyard',
    body: shipyardBody({ inventory: [{ elementId: 202, count: 90 }] }),
    confirmed: shipyardBody({ inventory: [{ elementId: 202, count: 100 }] }),
    missing: shipyardBody({ inventory: [{ elementId: 203, count: 4 }] }),
    before: { current: 90, queued: 0 },
  },
]

const scripts = [
  {
    name: 'base',
    page: 'buildings',
    body: constructionBody({ levels: [{ elementId: 1, level: 9 }] }),
  },
  ...operations,
]

const serverFailures: { name: string; reply: Reply }[] = [
  {
    name: 'an untrusted code',
    reply: {
      status: 302,
      headers: { Location: './game.php?page=fleetTable&code=private-token' },
      body: 'private response contents',
    },
  },
  {
    name: 'no code',
    reply: {
      body: JSON.stringify({ error: true, message: 'private server message' }),
      headers: { 'Content-Type': 'application/json' },
    },
  },
]

for (const script of scripts) {
  void test(`${script.name} stops when login is not confirmed`, async () => {
    const result = await runScript(script.name, [{}])
    expectFailure(result, 'server:login-unconfirmed')
    expectLogin(result)
  })

  void test(`${script.name} stops when the requested page is not returned`, async () => {
    const result = await runScript(script.name, [loginReply(), {}])
    expectFailure(result, 'server:page-unconfirmed')
    expectPage(result, script.page)
  })

  void test(`${script.name} rejects a different selected planet`, async () => {
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(script.body, 102)),
    ])
    expectFailure(result, 'server:planet-mismatch')
  })

  void test(`${script.name} reports protocol errors without response contents`, async () => {
    const result = await runScript(script.name, [
      { status: 500, body: 'private response contents' },
    ])
    expectFailure(result, 'server:500')
  })

  for (const failure of serverFailures)
    void test(`${script.name} reports server failures with ${failure.name} without response details`, async () => {
      const result = await runScript(script.name, [failure.reply])
      expectFailure(result, 'server')
      expectLogin(result)
    })

  void test(`${script.name} reports malformed responses without parser details`, async () => {
    const result = await runScript(script.name, [
      { body: '{"private"', headers: { 'Content-Type': 'application/json' } },
    ])
    expectFailure(result, 'parse')
  })

  void test(`${script.name} reports unknown failures without error details`, async () => {
    const result = await runScript(script.name, [new Error('private transport details')])
    expectFailure(result, 'unexpected')
  })
}

const submissionFailures: { name: string; reply: Reply | Error; code: string }[] = [
  {
    name: 'HTTP',
    reply: { status: 503, body: 'private response contents' },
    code: 'server:503',
  },
  { name: 'transport', reply: new Error('private transport details'), code: 'unexpected' },
]

for (const script of operations)
  for (const failure of submissionFailures)
    void test(`${script.name} confirms effective submission after ${failure.name} failure without retrying`, async () => {
      const result = await runScript(script.name, [
        loginReply(),
        pageReply(gamePage(script.body)),
        failure.reply,
        pageReply(gamePage(script.confirmed)),
      ])
      assert.equal(result.stdout, `${JSON.stringify({ ...script.before, status: 'confirmed' })}\n`)
      assert.equal(result.stderr, `Submission error (${failure.code})\n`)
      assert.equal(result.exitCode, undefined)
      expectPage(result, script.page)
      expectPage(result, script.page, 3)
      assert.equal(result.requests.length, 4)
      const request = requestAt(result, 2)
      assert.equal(request.url.href, requestAt(result, 1).url.href)
      assert.equal(request.method, 'POST')
    })

const upgrades = [
  { name: 'building', page: 'buildings', field: 'building', elementId: 1, targetLevel: 10 },
  { name: 'research', page: 'research', field: 'tech', elementId: 113, targetLevel: 5 },
]

for (const script of upgrades) {
  void test(`${script.name} submits one level and confirms its queued level after an empty receipt`, async () => {
    const level = script.targetLevel - 1
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(constructionBody({ levels: [{ elementId: script.elementId, level }] }))),
      { status: 204 },
      pageReply(
        gamePage(
          constructionBody({
            levels: [{ elementId: script.elementId, level }],
            queue: [
              { elementId: 2, level: 4 },
              { elementId: script.elementId, level: level + 1 },
            ],
          }),
        ),
      ),
    ])
    expectSuccess(result, `${JSON.stringify({ level, queued: false, status: 'confirmed' })}\n`)
    expectLogin(result)
    expectPage(result, script.page)
    expectPage(result, script.page, 3)
    const request = requestAt(result, 2)
    assert.equal(request.url.href, requestAt(result, 1).url.href)
    assert.equal(request.method, 'POST')
    assert.deepEqual(
      [...(request.body ?? [])],
      [
        ['cmd', 'insert'],
        [script.field, String(script.elementId)],
        ['lvlup', '1'],
        ['levelToBuildInFo', '0'],
      ],
    )
  })

  void test(`${script.name} refuses an omitted target instead of assuming zero`, async () => {
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(constructionBody({ levels: [{ elementId: 2, level: 4 }] }))),
    ])
    expectFailure(result, 'validation')
  })

  void test(`${script.name} skips a queued target`, async () => {
    const level = script.targetLevel - 1
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(
        gamePage(
          constructionBody({
            levels: [{ elementId: script.elementId, level }],
            queue: [{ elementId: script.elementId, level }],
          }),
        ),
      ),
    ])
    expectSuccess(result, `${JSON.stringify({ level, queued: true, status: 'skipped' })}\n`)
  })

  void test(`${script.name} can queue an upgrade behind another element`, async () => {
    const level = script.targetLevel - 1
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(
        gamePage(
          constructionBody({
            levels: [{ elementId: script.elementId, level }],
            queue: [{ elementId: 2, level: 2 }],
          }),
        ),
      ),
      {},
      pageReply(
        gamePage(
          constructionBody({
            levels: [{ elementId: script.elementId, level }],
            queue: [{ elementId: script.elementId, level: level + 1 }],
          }),
        ),
      ),
    ])
    expectSuccess(result, `${JSON.stringify({ level, queued: false, status: 'confirmed' })}\n`)
  })

  void test(`${script.name} skips a level at or above the target`, async () => {
    for (const level of [script.targetLevel, script.targetLevel + 1]) {
      const result = await runScript(script.name, [
        loginReply(),
        pageReply(gamePage(constructionBody({ levels: [{ elementId: script.elementId, level }] }))),
      ])
      expectSuccess(result, `${JSON.stringify({ level, queued: false, status: 'skipped' })}\n`)
    }
  })
}

void test('shipyard confirms the shortfall after natural progress and matching queued units', async () => {
  const result = await runScript('shipyard', [
    loginReply(),
    pageReply(
      gamePage(
        shipyardBody({
          inventory: [{ elementId: 202, count: 70 }],
          queue: [
            { elementId: 202, remaining: 10 },
            { elementId: 203, remaining: 50 },
            { elementId: 202, remaining: 5 },
          ],
        }),
      ),
    ),
    {},
    pageReply(
      gamePage(
        shipyardBody({
          inventory: [{ elementId: 202, count: 80 }],
          queue: [
            { elementId: 203, remaining: 50 },
            { elementId: 202, remaining: 5 },
            { elementId: 202, remaining: 15 },
          ],
        }),
      ),
    ),
  ])
  expectSuccess(result, '{"current":70,"queued":15,"status":"confirmed"}\n')
  expectLogin(result)
  expectPage(result, 'shipyard')
  expectPage(result, 'shipyard', 3)
  const request = requestAt(result, 2)
  assert.equal(request.url.href, requestAt(result, 1).url.href)
  assert.equal(request.method, 'POST')
  assert.deepEqual([...(request.body ?? [])], [['fmenge[202]', '15']])
})

void test('shipyard refuses an omitted target instead of assuming no stock', async () => {
  const result = await runScript('shipyard', [
    loginReply(),
    pageReply(gamePage(shipyardBody({ inventory: [{ elementId: 203, count: 4 }] }))),
  ])
  expectFailure(result, 'validation')
})

void test('shipyard confirms immediate production from inventory after an empty receipt', async () => {
  const result = await runScript('shipyard', [
    loginReply(),
    pageReply(gamePage(shipyardBody({ inventory: [{ elementId: 202, count: 90 }] }))),
    { status: 204 },
    pageReply(gamePage(shipyardBody({ inventory: [{ elementId: 202, count: 100 }] }))),
  ])
  expectSuccess(result, '{"current":90,"queued":0,"status":"confirmed"}\n')
  expectPage(result, 'shipyard')
  const request = requestAt(result, 2)
  assert.equal(request.url.href, requestAt(result, 1).url.href)
  assert.equal(request.method, 'POST')
  assert.deepEqual([...(request.body ?? [])], [['fmenge[202]', '10']])
})

void test('shipyard skips production when stock and queue meet or exceed the target', async () => {
  for (const current of [90, 100]) {
    const result = await runScript('shipyard', [
      loginReply(),
      pageReply(
        gamePage(
          shipyardBody({
            inventory: [{ elementId: 202, count: current }],
            queue: [{ elementId: 202, remaining: 10 }],
          }),
        ),
      ),
    ])
    expectSuccess(result, `${JSON.stringify({ current, queued: 10, status: 'skipped' })}\n`)
  }
})

for (const script of operations) {
  void test(`${script.name} reports a failed submission that did not change the observed state`, async () => {
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(script.body)),
      new Error('private transport details'),
      pageReply(gamePage(script.body)),
    ])
    assert.equal(result.stdout, `${JSON.stringify({ ...script.before, status: 'mismatch' })}\n`)
    assert.equal(result.stderr, 'Submission error (unexpected)\n')
    assert.equal(result.exitCode, undefined)
  })

  void test(`${script.name} confirms rejection from unchanged state without exposing the receipt`, async () => {
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(script.body)),
      pageReply(gamePage('<div class="ally_contents">private-server-message</div>')),
      pageReply(gamePage(script.body)),
    ])
    expectSuccess(result, `${JSON.stringify({ ...script.before, status: 'mismatch' })}\n`)
    expectPage(result, script.page, 3)
  })

  const readFailures: { name: string; reply: Reply | Error; code: string }[] = [
    { name: 'unconfirmed page', reply: {}, code: 'server:page-unconfirmed' },
    {
      name: 'different planet',
      reply: pageReply(gamePage(script.confirmed, 102)),
      code: 'server:planet-mismatch',
    },
    { name: 'missing target', reply: pageReply(gamePage(script.missing)), code: 'validation' },
    {
      name: 'HTTP failure',
      reply: { status: 503, body: 'private response contents' },
      code: 'server:503',
    },
    {
      name: 'transport failure',
      reply: new Error('private transport details'),
      code: 'unexpected',
    },
  ]
  for (const failure of readFailures)
    void test(`${script.name} does not claim confirmation when readback has ${failure.name}`, async () => {
      const result = await runScript(script.name, [
        loginReply(),
        pageReply(gamePage(script.body)),
        {},
        failure.reply,
      ])
      expectFailure(result, failure.code)
      assert.equal(result.requests.length, 4)
      expectPage(result, script.page, 3)
    })

  void test(`${script.name} reports submission and readback failures without retrying the write`, async () => {
    const result = await runScript(script.name, [
      loginReply(),
      pageReply(gamePage(script.body)),
      new Error('private submission failure'),
      new Error('private read failure'),
    ])
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'Submission error (unexpected)\nScript failed (unexpected)\n')
    assert.equal(result.exitCode, 1)
    assert.equal(result.requests.length, 4)
  })
}

for (const script of upgrades) {
  for (const completed of [script.targetLevel, script.targetLevel + 1])
    void test(`${script.name} confirms an already completed upgrade at level ${completed}`, async () => {
      const level = script.targetLevel - 1
      const result = await runScript(script.name, [
        loginReply(),
        pageReply(gamePage(constructionBody({ levels: [{ elementId: script.elementId, level }] }))),
        {},
        pageReply(
          gamePage(
            constructionBody({ levels: [{ elementId: script.elementId, level: completed }] }),
          ),
        ),
      ])
      expectSuccess(result, `${JSON.stringify({ level, queued: false, status: 'confirmed' })}\n`)
    })

  for (const queuedLevel of [script.targetLevel - 1, script.targetLevel + 1])
    void test(`${script.name} does not confirm an unrelated queued level ${queuedLevel}`, async () => {
      const level = script.targetLevel - 1
      const result = await runScript(script.name, [
        loginReply(),
        pageReply(gamePage(constructionBody({ levels: [{ elementId: script.elementId, level }] }))),
        {},
        pageReply(
          gamePage(
            constructionBody({
              levels: [{ elementId: script.elementId, level }],
              queue: [{ elementId: script.elementId, level: queuedLevel }],
            }),
          ),
        ),
      ])
      expectSuccess(result, `${JSON.stringify({ level, queued: false, status: 'mismatch' })}\n`)
    })
}

void test('shipyard reports partial production below the target as a mismatch', async () => {
  const result = await runScript('shipyard', [
    loginReply(),
    pageReply(gamePage(shipyardBody({ inventory: [{ elementId: 202, count: 90 }] }))),
    {},
    pageReply(
      gamePage(
        shipyardBody({
          inventory: [{ elementId: 202, count: 90 }],
          queue: [{ elementId: 202, remaining: 5 }],
        }),
      ),
    ),
  ])
  expectSuccess(result, '{"current":90,"queued":0,"status":"mismatch"}\n')
})

void test('shipyard does not mistake completion of existing queued units for new production', async () => {
  const result = await runScript('shipyard', [
    loginReply(),
    pageReply(
      gamePage(
        shipyardBody({
          inventory: [{ elementId: 202, count: 80 }],
          queue: [{ elementId: 202, remaining: 10 }],
        }),
      ),
    ),
    {},
    pageReply(gamePage(shipyardBody({ inventory: [{ elementId: 202, count: 90 }] }))),
  ])
  expectSuccess(result, '{"current":80,"queued":10,"status":"mismatch"}\n')
})
