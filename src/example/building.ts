import { Operator, Courier, Config, PlanetType } from '@senators/bifrost'

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
  // 获取id=114514的建筑等级
  const level = planet.elements.get(114514)
  // 获取id=114514的建筑队列
  const queue = planet.queues.building
  // 如果建筑114514的等级小于10，且建造队列中建筑114514的最后一个值小于10，则升级1级
  if (level < 10 && queue.getLastCount(114514) < 10) {
    await operator.buildBuilding({
      cp: planet.id,
      element: 114514,
      count: 1,
    })
  }
}
