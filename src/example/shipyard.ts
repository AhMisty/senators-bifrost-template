/**
 * @file Log in, request missing ships and verify stock plus queued production.
 *
 * 登录后按需补造舰船，并回读库存与生产队列确认。
 */
import {
  Session,
  shipyard,
  shipyardProduce,
  OperationError,
  ServerError,
  ValidationError,
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

try {
  const session = new Session({
    baseUrl: 'https://your-server.example/game/',
    universe: 1,
    username: 'pilot',
    password: 'secret',
  })
  const target = { planetId: 101, elementId: 202, targetCount: 100 }

  const login = await session.login()
  if (login.data.kind !== 'login')
    throw new ServerError('Login was not confirmed', 'login-unconfirmed', login.response)

  const readState = async () => {
    const page = await shipyard(session, target)
    if (page.data.kind !== 'shipyard')
      throw new ServerError('Shipyard page was not returned', 'page-unconfirmed', page.response)

    if (page.data.planetId !== target.planetId)
      throw new ServerError(
        'The server selected a different planet',
        'planet-mismatch',
        page.response,
      )

    const current = page.data.inventory.get(target.elementId)
    if (current === undefined)
      throw new ValidationError('The requested ship is absent from the inventory catalogue')

    const queued = page.data.queue.reduce(
      (total, entry) => total + (entry.elementId === target.elementId ? entry.remaining : 0),
      0,
    )
    return { current, queued }
  }

  const { current, queued } = await readState()
  const shortfall = target.targetCount - current - queued
  let status = 'skipped'
  if (shortfall > 0) {
    try {
      await shipyardProduce(session, {
        planetId: target.planetId,
        elements: new Map([[target.elementId, shortfall]]),
      })
    } catch (error) {
      process.stderr.write(`Submission error (${errorCode(error)})\n`)
    }

    const updated = await readState()
    status = updated.current + updated.queued >= target.targetCount ? 'confirmed' : 'mismatch'
  }

  process.stdout.write(`${JSON.stringify({ current, queued, status })}\n`)
} catch (error) {
  process.stderr.write(`Script failed (${errorCode(error)})\n`)
  process.exitCode = 1
}
