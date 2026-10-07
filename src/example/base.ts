/**
 * @file Log in explicitly and query a building level and free fields; running or importing contacts the game server.
 *
 * 显式登录并查询建筑等级和空闲地块；运行或导入会请求游戏服务器。
 */
import { Session, buildings, OperationError, ServerError } from '@senators/bifrost/game'

try {
  const session = new Session({
    baseUrl: 'https://your-server.example/game/',
    universe: 1,
    username: 'pilot',
    password: 'secret',
  })
  const planet = { planetId: 101 }
  const elementId = 1

  const login = await session.login()
  if (login.data.kind !== 'login')
    throw new ServerError('Login was not confirmed', 'login-unconfirmed', login.response)

  const page = await buildings(session, planet)
  if (page.data.kind !== 'buildings')
    throw new ServerError('Building page was not returned', 'page-unconfirmed', page.response)

  if (page.data.planetId !== planet.planetId)
    throw new ServerError(
      'The server selected a different planet',
      'planet-mismatch',
      page.response,
    )

  const level = page.data.levels.get(elementId)
  const freeFields = page.data.fields.free
  process.stdout.write(
    `Planet ${page.data.planetId}: building ${elementId} level ${level ?? 'unknown'}, free fields ${freeFields}\n`,
  )
} catch (error) {
  const code =
    error instanceof ServerError &&
    /^(?:login-unconfirmed|page-unconfirmed|planet-mismatch|-?\d{1,3})$/.test(
      String(error.serverCode),
    )
      ? `${error.code}:${error.serverCode}`
      : error instanceof OperationError
        ? error.code
        : 'unexpected'
  process.stderr.write(`Script failed (${code})\n`)
  process.exitCode = 1
}
