/**
 * @file Log in and dispatch repeatedly, waiting ten minutes after each round; press Ctrl+C to stop.
 *
 * 登录后循环派遣，每轮结束后等待十分钟；按 Ctrl+C 停止。
 */
import { setTimeout } from 'node:timers/promises'

import {
  FleetMission,
  OperationError,
  Session,
  ServerError,
  dispatchFleet,
  fleetTable,
} from '@senators/bifrost/game'
import type {
  Coordinate,
  DispatchFleetOptions,
  DispatchFleetResult,
  FleetTableEntry,
  FleetTablePage,
} from '@senators/bifrost/game'

function errorCode(error: unknown): string {
  return error instanceof ServerError &&
    /^(?:login-unconfirmed|page-unconfirmed|planet-mismatch|-?\d{1,3})$/.test(
      String(error.serverCode),
    )
    ? `${error.code}:${error.serverCode}`
    : error instanceof OperationError
      ? error.code
      : 'unexpected'
}

function sameCoordinate(left: Coordinate, right: Coordinate): boolean {
  return (
    left.galaxy === right.galaxy && left.system === right.system && left.planet === right.planet
  )
}

async function readFleets(session: Session, planetId: number): Promise<FleetTablePage> {
  const page = await fleetTable(session, { planetId })
  if (page.data.kind !== 'fleetTable')
    throw new ServerError('Fleet table was not returned', 'page-unconfirmed', page.response)
  if (page.data.planetId !== planetId)
    throw new ServerError(
      'The server selected a different planet',
      'planet-mismatch',
      page.response,
    )
  return page.data
}

type Confirmation = {
  status: 'confirmed' | 'unverified' | 'mismatch'
  fleetId: number | null
}

function confirm(
  result: DispatchFleetResult | undefined,
  before: FleetTablePage,
  after: FleetTablePage | undefined,
  options: DispatchFleetOptions,
): Confirmation {
  if (
    result === undefined ||
    result.stage !== 'dispatch' ||
    result.dispatch.data.kind !== 'fleetStep3'
  )
    return { status: 'unverified', fleetId: null }
  const receipt = result.dispatch.data
  if (
    receipt.planetId !== options.origin.planetId ||
    !sameCoordinate(receipt.origin, result.draft.data.origin) ||
    !sameCoordinate(receipt.target, options.target) ||
    receipt.ships.size !== options.ships.size ||
    [...options.ships].some(([id, amount]) => receipt.ships.get(id) !== amount)
  )
    return { status: 'mismatch', fleetId: null }
  const mission = result.destination.data.missions.find((entry) => entry.value === options.mission)
  if (mission === undefined || !mission.label) return { status: 'unverified', fleetId: null }
  if (receipt.missionText !== mission.label) return { status: 'mismatch', fleetId: null }
  if (after === undefined) return { status: 'unverified', fleetId: null }

  const previousIds = new Set(before.fleets.map((fleet) => fleet.id))
  const added = after.fleets.filter((fleet) => fleet.id !== null && !previousIds.has(fleet.id))
  const fleet = added.length === 1 ? added[0] : undefined
  if (fleet === undefined) return { status: 'unverified', fleetId: null }
  const amount = [...receipt.ships.values()].reduce((total, count) => total + count, 0)
  /**
   * The table labels target arrival as departure and fleet end as arrival; compare the server's matching time fields.
   *
   * 舰队表将目标抵达标为出发、舰队结束标为抵达，按服务端实际对应的时间字段比较。
   */
  const matches = (entry: FleetTableEntry): boolean =>
    sameCoordinate(entry.origin, receipt.origin) &&
    sameCoordinate(entry.target, receipt.target) &&
    entry.missionText === receipt.missionText &&
    entry.departureText === receipt.targetArrivalTimeText &&
    entry.arrivalText === receipt.endTimeText &&
    entry.amount === amount
  return matches(fleet) && !after.fleets.some((entry) => entry.id === null && matches(entry))
    ? { status: 'confirmed', fleetId: fleet.id }
    : { status: 'unverified', fleetId: null }
}

try {
  const session = new Session({
    baseUrl: 'https://your-server.example/game/',
    universe: 1,
    username: 'pilot',
    password: 'secret',
    /**
     * Log in when needed and retry an expired request once; the new session may reject its draft token.
     *
     * 缺少会话时登录，明确过期后重试当前请求一次；新会话可能拒绝其草稿令牌。
     */
    autoLogin: true,
  })

  const options: DispatchFleetOptions = {
    origin: {
      planetId: 101,
    },
    ships: new Map([[210, 1]]),
    target: {
      galaxy: 1,
      system: 2,
      planet: 16,
      type: 1,
    },
    speed: 10,
    mission: FleetMission.Expedition,
    /**
     * A stay option value from the destination form, not a duration in seconds.
     *
     * 目的地表单的驻留选项值，不是秒数。
     */
    stayOption: 1,
  }

  const delayMs = 10 * 60 * 1000

  while (true) {
    try {
      if (!session.sessionToken) {
        const login = await session.login()
        if (login.data.kind !== 'login')
          throw new ServerError('Login was not confirmed', 'login-unconfirmed', login.response)
      }
      const before = await readFleets(session, options.origin.planetId)
      let result: DispatchFleetResult | undefined
      try {
        result = await dispatchFleet(session, options)
      } catch (error) {
        process.stderr.write(`Dispatch failed (${errorCode(error)})\n`)
      }
      let after: FleetTablePage | undefined
      try {
        after = await readFleets(session, options.origin.planetId)
      } catch (error) {
        process.stderr.write(`Verification failed (${errorCode(error)})\n`)
      }
      process.stdout.write(`${JSON.stringify(confirm(result, before, after, options))}\n`)
    } catch (error) {
      process.stderr.write(`Dispatch failed (${errorCode(error)})\n`)
    }
    await setTimeout(delayMs)
  }
} catch (error) {
  process.stderr.write(`Script failed (${errorCode(error)})\n`)
  process.exitCode = 1
}
