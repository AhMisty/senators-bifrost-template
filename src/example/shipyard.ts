import { Operator, Courier, Config, Elements, PlanetType } from '@senators/bifrost'

// 初始化配置和客户端
const config = new Config()
const courier = new Courier({
  base: 'https://example.com',
  timeout: 10000,
})

// 创建操作员
const operator = new Operator({
  universe: 1,
  username: 'username',
  password: 'password',
  courier,
  config,
})

// 更新游戏数据
await operator.update()

// 获取id=114514的星球
const planet = operator.planets.map.get(114514)

// 检查星球是否存在且为行星
if (planet && planet.type === PlanetType.Planet) {
  // 获取id=114514的舰船数量
  const currentCount = planet.elements.get(114514)
  // 获取id=114514的舰船队列
  const queueCount = planet.queues.shipyard
  // 获取id=114514的舰船的总计数量，即当前数量+队列中的总数量
  const totalCount = currentCount + queueCount.getTotalCount(114514)
  // 如果舰船114514的现有数量+队列中的总计数量小于1000，则追加差额
  if (totalCount < 1000) {
    const diffCount = 1000 - totalCount
    const ships = new Elements()
    ships.set(114514, diffCount)
    await operator.buildShipyard({
      cp: planet.id,
      elements: ships,
    })
  }
}
