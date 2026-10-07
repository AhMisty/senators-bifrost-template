/**
 * @file Log in, request one research level when needed and verify the resulting state.
 *
 * 登录后按需追加一级研究，并回读状态确认。
 */
import {
  Session,
  research,
  researchUpgrade,
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
  const target = { planetId: 101, elementId: 113, targetLevel: 5 }

  const login = await session.login()
  if (login.data.kind !== 'login')
    throw new ServerError('Login was not confirmed', 'login-unconfirmed', login.response)

  const readState = async () => {
    const page = await research(session, target)
    if (page.data.kind !== 'research')
      throw new ServerError('Research page was not returned', 'page-unconfirmed', page.response)

    if (page.data.planetId !== target.planetId)
      throw new ServerError(
        'The server selected a different planet',
        'planet-mismatch',
        page.response,
      )

    const level = page.data.levels.get(target.elementId)
    if (level === undefined)
      throw new ValidationError('The requested element is absent from the level catalogue')

    return { level, queue: page.data.queue }
  }

  const { level, queue } = await readState()

  const queued = queue.some((entry) => entry.elementId === target.elementId)
  let status = 'skipped'
  if (level < target.targetLevel && !queued) {
    try {
      await researchUpgrade(session, {
        planetId: target.planetId,
        elementId: target.elementId,
        levels: 1,
      })
    } catch (error) {
      process.stderr.write(`Submission error (${errorCode(error)})\n`)
    }

    const updated = await readState()
    status =
      updated.level >= level + 1 ||
      updated.queue.some(
        (entry) => entry.elementId === target.elementId && entry.level === level + 1,
      )
        ? 'confirmed'
        : 'mismatch'
  }

  process.stdout.write(`${JSON.stringify({ level, queued, status })}\n`)
} catch (error) {
  process.stderr.write(`Script failed (${errorCode(error)})\n`)
  process.exitCode = 1
}
