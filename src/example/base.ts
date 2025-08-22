import { Operator, Courier, Config } from '@senators/bifrost'

// 创建配置
const config = new Config()

// 创建 HTTP 客户端
const courier = new Courier('https://example.com', 10000)

// 创建操作员实例
const operator = new Operator(
  1, // 宇宙编号
  'username', // 用户名
  'password', // 密码
  courier,
  config,
)

// 可选，添加钩子函数
operator.onUpdateControl = async (_operator) => {
  console.log('正在更新总览数据')
}
operator.onUpdateResearch = async (_operator) => {
  console.log('正在更新研究数据')
}
operator.onUpdatePlanets = async (_operator) => {
  console.log('正在更新行星数据')
}
// ......
operator.onUpdatePlanetBuilding = async (_operator, planet) => {
  console.log(`正在更新行星${planet.name}[${planet.coordinate.toString()}]的建筑数据`)
}
operator.onUpdatePlanetShipyard = async (_operator, planet) => {
  console.log(`正在更新行星${planet.name}[${planet.coordinate.toString()}]的船坞数据`)
}
// ......

// 更新游戏数据（自动处理登录）
await operator.update()

// 访问游戏数据
console.log(operator)
