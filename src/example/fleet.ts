import { Operator, Courier, Config, Fleet, Elements } from '@senators/bifrost'

// 初始化配置和客户端
const config = new Config()
const courier = new Courier('https://example.com', 10000)

// 创建操作员
const operator = new Operator(1, 'username', 'password', courier, config)

// 配置舰队
const ships = new Elements()
ships.set(210, 99999) // 设置舰船210，数量99999艘

// 创建舰队任务
const fleet = new Fleet({
  cp: 1, // 起点星球ID
  galaxy: 1, // 目标河系
  system: 1, // 目标星系
  planet: 1, // 目标星球
  type: 1, // 星球类型：1=行星
  mission: 15, // 任务类型：15=探险
  speed: 10, // 速度：10=最快
  staytime: 1, // 停留时间：1小时
  metal: 0, // 金属：0
  crystal: 0, // 晶体：0
  deuterium: 0, // 重氢：0
  ships, // 舰船配置
})

// 监听发送舰队错误事件
operator.onSendFleetStep1Invalid = async (_operator, _fleet, allyContent) => {
  console.error(`步骤1出现错误: ${allyContent}`)
}
operator.onSendFleetStep2Invalid = async (_operator, _fleet, allyContent) => {
  console.error(`步骤2出现错误: ${allyContent}`)
}
operator.onSendFleetStep3Invalid = async (_operator, _fleet, allyContent) => {
  console.error(`步骤3出现错误: ${allyContent}`)
}

// 封装发送舰队函数
const sendFleet = async () => {
  // 执行舰队任务
  console.log(`执行舰队任务 ${new Date().toLocaleTimeString()}`)
  if (await operator.sendFleet(fleet)) {
    console.log('舰队已派出！')
  }
}

// 先执行一次
await sendFleet()

// 每5分钟执行一次
setInterval(sendFleet, 1000 * 60 * 5)
