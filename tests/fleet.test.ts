import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  fleetDestinationBody,
  fleetDispatchBody,
  fleetDraftBody,
  fleetTableBody,
  refusedFleetBody,
} from './fixtures/fleet.ts'
import type { FleetEntry } from './fixtures/fleet.ts'
import { gamePage, loginReply, pageReply, runScript } from './helpers.ts'
import type { Reply, ScriptResult } from './helpers.ts'

const STOP_MESSAGE = 'Script failed (unexpected)\n'
const UNVERIFIED = '{"status":"unverified","fleetId":null}\n'
const MISMATCH = '{"status":"mismatch","fleetId":null}\n'
const CONFIRMED = '{"status":"confirmed","fleetId":55}\n'

function page(body: string, planetId = 101): Reply {
  return pageReply(gamePage(body, planetId))
}

function successfulRound(): Reply[] {
  return [
    fleetTableBody(),
    fleetDraftBody,
    fleetDestinationBody,
    fleetDispatchBody,
    fleetTableBody([{ id: 55 }]),
  ].map((body) => page(body))
}

/**
 * End the infinite example after a fixed number of rounds while exercising its actual delay calls.
 *
 * 在指定轮数后结束无限循环示例，同时验证真实的等待调用。
 */
function runFleet(replies: (Reply | Error)[], rounds = 1): Promise<ScriptResult> {
  return runScript('fleet', replies, { rounds })
}

function requestPages(result: ScriptResult): (string | null)[] {
  return result.requests.map((request) => request.url.searchParams.get('page'))
}

void test('fleet verifies a unique new fleet after dispatching the configured expedition', async () => {
  const result = await runFleet([loginReply(), ...successfulRound()])
  assert.deepEqual(requestPages(result), [
    'login',
    'fleetTable',
    'fleetStep1',
    'fleetStep2',
    'fleetStep3',
    'fleetTable',
  ])
  assert.deepEqual(
    result.requests.map((request) => request.method),
    ['POST', 'GET', 'POST', 'POST', 'POST', 'GET'],
  )
  assert.ok(
    result.requests.every((request) => request.url.origin === 'https://your-server.example'),
  )
  const [login, before, draft, destination, dispatch, after] = result.requests
  assert.ok(login && before && draft && destination && dispatch && after)
  assert.equal(login.body?.get('username'), 'pilot')
  assert.equal(login.body?.get('password'), 'secret')
  assert.equal(login.url.searchParams.get('uni'), '1')
  for (const request of [before, draft, destination, dispatch, after])
    assert.equal(request.url.searchParams.get('cp'), '101')
  assert.equal(draft.body?.get('ship210'), '1')
  assert.equal(destination.body?.get('token'), 'draft-token')
  assert.equal(destination.body?.get('galaxy'), '1')
  assert.equal(destination.body?.get('system'), '2')
  assert.equal(destination.body?.get('planet'), '16')
  assert.equal(destination.body?.get('type'), '1')
  assert.equal(destination.body?.get('speed'), '10')
  assert.equal(dispatch.body?.get('token'), 'destination-token')
  assert.equal(dispatch.body?.get('mission'), '15')
  assert.equal(dispatch.body?.get('staytime'), '1')
  assert.equal(result.stdout, CONFIRMED)
  assert.equal(result.stderr, STOP_MESSAGE)
  assert.equal(result.exitCode, 1)
  assert.deepEqual(result.delays, [600000])
})

const failures: { name: string; reply: Reply | Error; code: string }[] = [
  { name: 'HTTP failure', reply: { status: 503, body: 'private-server' }, code: 'server:503' },
  {
    name: 'numeric code',
    reply: { status: 302, headers: { Location: './game.php?page=fleetTable&code=-12' } },
    code: 'server:-12',
  },
  ...['private-token', '1000', '1%0A'].map((value) => ({
    name: `untrusted code ${value}`,
    reply: { status: 302, headers: { Location: `./game.php?page=fleetTable&code=${value}` } },
    code: 'server',
  })),
  {
    name: 'no server code',
    reply: {
      body: JSON.stringify({ error: true, message: 'private-server' }),
      headers: { 'Content-Type': 'application/json' },
    },
    code: 'server',
  },
  {
    name: 'malformed response',
    reply: { body: '{"private"', headers: { 'Content-Type': 'application/json' } },
    code: 'parse',
  },
  { name: 'transport failure', reply: new Error('private-network'), code: 'unexpected' },
]

for (const failure of failures)
  void test(`fleet recovers after initial login ${failure.name} without exposing details`, async () => {
    const result = await runFleet([failure.reply, loginReply(), ...successfulRound()], 2)
    assert.equal(result.stdout, CONFIRMED)
    assert.equal(result.stderr, `Dispatch failed (${failure.code})\n${STOP_MESSAGE}`)
    assert.deepEqual(result.waitSnapshots, [1, 7])
    assert.deepEqual(result.delays, [600000, 600000])
  })

void test('fleet retries an unconfirmed initial login in the next round', async () => {
  const result = await runFleet(
    [
      { status: 302, headers: { Location: 'index.php?page=login' }, body: 'private-login' },
      loginReply(),
      ...successfulRound(),
    ],
    2,
  )
  assert.equal(result.stdout, CONFIRMED)
  assert.equal(result.stderr, `Dispatch failed (server:login-unconfirmed)\n${STOP_MESSAGE}`)
  assert.deepEqual(result.waitSnapshots, [1, 7])
})

for (const failure of [
  { name: 'receipt', reply: page(refusedFleetBody), code: 'server:page-unconfirmed' },
  { name: 'different planet', reply: page(fleetTableBody(), 102), code: 'server:planet-mismatch' },
  { name: 'request failure', reply: new Error('private-read'), code: 'unexpected' },
])
  void test(`fleet skips dispatch after a pre-read ${failure.name} and resumes next round`, async () => {
    const result = await runFleet([loginReply(), failure.reply, ...successfulRound()], 2)
    assert.equal(result.stdout, CONFIRMED)
    assert.equal(result.stderr, `Dispatch failed (${failure.code})\n${STOP_MESSAGE}`)
    assert.deepEqual(result.waitSnapshots, [2, 7])
    assert.deepEqual(requestPages(result).slice(0, 3), ['login', 'fleetTable', 'fleetTable'])
  })

for (const scenario of [
  { name: 'draft', preceding: [] },
  { name: 'destination', preceding: [fleetDraftBody] },
  { name: 'dispatch', preceding: [fleetDraftBody, fleetDestinationBody] },
]) {
  void test(`fleet reads back an unconfirmed ${scenario.name} response`, async () => {
    const result = await runFleet([
      loginReply(),
      page(fleetTableBody()),
      ...scenario.preceding.map((body) => page(body)),
      page(refusedFleetBody),
      page(fleetTableBody([{ id: 55 }])),
    ])
    assert.equal(result.stdout, UNVERIFIED)
    assert.equal(result.stderr, STOP_MESSAGE)
    assert.equal(requestPages(result).at(-1), 'fleetTable')
  })

  void test(`fleet reads back after a ${scenario.name} exception without retrying writes`, async () => {
    const result = await runFleet(
      [
        loginReply(),
        page(fleetTableBody()),
        ...scenario.preceding.map((body) => page(body)),
        new Error('private-submit'),
        page(fleetTableBody([{ id: 55 }])),
        ...successfulRound(),
      ],
      2,
    )
    assert.equal(result.stdout, UNVERIFIED + CONFIRMED)
    assert.equal(result.stderr, `Dispatch failed (unexpected)\n${STOP_MESSAGE}`)
    assert.deepEqual(result.waitSnapshots, [
      scenario.preceding.length + 4,
      scenario.preceding.length + 9,
    ])
    assert.equal(requestPages(result)[scenario.preceding.length + 3], 'fleetTable')
  })
}

for (const failure of [
  { name: 'receipt', reply: page(refusedFleetBody), code: 'server:page-unconfirmed' },
  { name: 'different planet', reply: page(fleetTableBody(), 102), code: 'server:planet-mismatch' },
  { name: 'request failure', reply: new Error('private-read'), code: 'unexpected' },
])
  void test(`fleet reports an unverified result after a readback ${failure.name}`, async () => {
    const result = await runFleet(
      [loginReply(), ...successfulRound().slice(0, -1), failure.reply, ...successfulRound()],
      2,
    )
    assert.equal(result.stdout, UNVERIFIED + CONFIRMED)
    assert.equal(result.stderr, `Verification failed (${failure.code})\n${STOP_MESSAGE}`)
    assert.deepEqual(result.waitSnapshots, [6, 11])
  })

for (const scenario of [
  { name: 'no new fleet', before: fleetTableBody(), after: fleetTableBody() },
  {
    name: 'an old matching fleet',
    before: fleetTableBody([{ id: 55 }]),
    after: fleetTableBody([{ id: 55 }]),
  },
  {
    name: 'multiple new fleets',
    before: fleetTableBody(),
    after: fleetTableBody([{ id: 55 }, { id: 56 }]),
  },
  {
    name: 'a fleet without an id',
    before: fleetTableBody(),
    after: fleetTableBody([{ id: null }]),
  },
  {
    name: 'a matching fleet with an unknown id beside the new fleet',
    before: fleetTableBody(),
    after: fleetTableBody([{ id: 55 }, { id: null }]),
  },
])
  void test(`fleet does not confirm ${scenario.name}`, async () => {
    const result = await runFleet([
      loginReply(),
      page(scenario.before),
      page(fleetDraftBody),
      page(fleetDestinationBody),
      page(fleetDispatchBody),
      page(scenario.after),
    ])
    assert.equal(result.stdout, UNVERIFIED)
    assert.equal(result.stderr, STOP_MESSAGE)
  })

void test('fleet identifies a new id among existing fleets without relying on count growth', async () => {
  const result = await runFleet([
    loginReply(),
    page(fleetTableBody([{ id: 54 }])),
    page(fleetDraftBody),
    page(fleetDestinationBody),
    page(fleetDispatchBody),
    page(fleetTableBody([{ id: 55 }])),
  ])
  assert.equal(result.stdout, CONFIRMED)
})

void test('fleet excludes unrelated records with unknown ids from receipt attribution', async () => {
  const result = await runFleet([
    loginReply(),
    ...successfulRound().slice(0, -1),
    page(fleetTableBody([{ id: 55 }, { id: null, target: '[1:2:15]' }])),
  ])
  assert.equal(result.stdout, CONFIRMED)
})

for (const [name, body, planetId] of [
  ['receipt planet', fleetDispatchBody, 102],
  ['origin galaxy', fleetDispatchBody.replace('[1:2:3]', '[2:2:3]'), 101],
  ['origin system', fleetDispatchBody.replace('[1:2:3]', '[1:3:3]'), 101],
  ['origin position', fleetDispatchBody.replace('[1:2:3]', '[1:2:4]'), 101],
  ['target', fleetDispatchBody.replace('[1:2:16]', '[1:2:15]'), 101],
  ['mission', fleetDispatchBody.replace('>Expedition<', '>Transport<'), 101],
  ['ship id', fleetDispatchBody.replace('210.gif', '202.gif'), 101],
  ['ship count', fleetDispatchBody.replace('class="fleettab15">1', 'class="fleettab15">2'), 101],
  [
    'extra ship',
    fleetDispatchBody +
      '<div class="alleanza1"><img src="gebaeude/202.gif"><span class="fleettab15">1</span></div>',
    101,
  ],
] satisfies [string, string, number][])
  void test(`fleet reports a configuration mismatch for the ${name}`, async () => {
    const result = await runFleet([
      loginReply(),
      page(fleetTableBody()),
      page(fleetDraftBody),
      page(fleetDestinationBody),
      page(body, planetId),
      page(fleetTableBody([{ id: 55 }])),
    ])
    assert.equal(result.stdout, MISMATCH)
    assert.equal(result.stderr, STOP_MESSAGE)
  })

for (const destination of [
  fleetDestinationBody.replace('value="15"', 'value="3"'),
  fleetDestinationBody.replace('>Expedition</label>', '></label>'),
])
  void test('fleet cannot verify a mission without the requested form label', async () => {
    const result = await runFleet([
      loginReply(),
      page(fleetTableBody()),
      page(fleetDraftBody),
      page(destination),
      page(fleetDispatchBody),
      page(fleetTableBody([{ id: 55 }])),
    ])
    assert.equal(result.stdout, UNVERIFIED)
  })

void test('fleet reports a known target mismatch even without a mission label', async () => {
  const result = await runFleet([
    loginReply(),
    page(fleetTableBody()),
    page(fleetDraftBody),
    page(fleetDestinationBody.replace('>Expedition</label>', '></label>')),
    page(fleetDispatchBody.replace('[1:2:16]', '[1:2:15]')),
    page(fleetTableBody([{ id: 55 }])),
  ])
  assert.equal(result.stdout, MISMATCH)
})

const tableMismatches: {
  name: string
  fleet: FleetEntry
}[] = [
  { name: 'origin', fleet: { id: 55, origin: '[1:2:4]' } },
  { name: 'target', fleet: { id: 55, target: '[1:2:15]' } },
  { name: 'mission', fleet: { id: 55, mission: 'Transport' } },
  { name: 'target arrival', fleet: { id: 55, departure: '01.01.2026 12:00:01' } },
  { name: 'end time', fleet: { id: 55, arrival: '01.01.2026 13:00:01' } },
  { name: 'missing end time', fleet: { id: 55, arrival: null } },
  { name: 'ship total', fleet: { id: 55, amount: 2 } },
]
for (const { name, fleet } of tableMismatches)
  void test(`fleet leaves a newly visible fleet with a different ${name} unverified`, async () => {
    const result = await runFleet([
      loginReply(),
      ...successfulRound().slice(0, -1),
      page(fleetTableBody([fleet])),
    ])
    assert.equal(result.stdout, UNVERIFIED)
    assert.equal(result.stderr, STOP_MESSAGE)
  })

void test('fleet compares localized mission labels without an English assumption', async () => {
  const result = await runFleet([
    loginReply(),
    page(fleetTableBody()),
    page(fleetDraftBody),
    page(fleetDestinationBody.replace('>Expedition</label>', '>探索</label>')),
    page(fleetDispatchBody.replace('>Expedition<', '>探索<')),
    page(fleetTableBody([{ id: 55, mission: '探索' }])),
  ])
  assert.equal(result.stdout, CONFIRMED)
})

void test('fleet waits for readback and the full delay before the next round', async () => {
  const result = await runFleet([loginReply(), ...successfulRound(), ...successfulRound()], 2)
  assert.equal(result.stdout, CONFIRMED + CONFIRMED)
  assert.equal(result.stderr, STOP_MESSAGE)
  assert.deepEqual(result.waitSnapshots, [6, 11])
  assert.deepEqual(result.delays, [600000, 600000])
})

for (const scenario of [
  { stage: 'destination', preceding: [fleetDraftBody], token: 'draft-token', code: 0 },
  {
    stage: 'dispatch',
    preceding: [fleetDraftBody, fleetDestinationBody],
    token: 'destination-token',
    code: 1,
  },
])
  void test(`fleet reads back and resumes after ${scenario.stage} expiry invalidates its draft`, async () => {
    const result = await runFleet(
      [
        loginReply(),
        page(fleetTableBody()),
        ...scenario.preceding.map((body) => page(body)),
        { status: 302, headers: { Location: './index.php?code=3' } },
        loginReply(),
        {
          status: 302,
          headers: { Location: `./game.php?page=fleetTable&code=${scenario.code}` },
          body: 'private-draft',
        },
        page(fleetTableBody()),
        ...successfulRound(),
      ],
      2,
    )
    assert.equal(result.stdout, UNVERIFIED + CONFIRMED)
    assert.equal(
      result.stderr,
      (scenario.code === 1 ? 'Dispatch failed (server:1)\n' : '') + STOP_MESSAGE,
    )
    const attempts = result.requests.filter(
      (request) => request.body?.get('token') === scenario.token,
    )
    assert.equal(attempts.length, 3)
    assert.equal(attempts[0]?.body?.toString(), attempts[1]?.body?.toString())
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /draft-token|destination-token|private|secret|confirmed-session/,
    )
    assert.deepEqual(result.delays, [600000, 600000])
  })
