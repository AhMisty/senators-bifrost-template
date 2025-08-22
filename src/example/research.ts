import { Operator, Courier, Config } from '@senators/bifrost'

// 初始化配置和客户端
const config = new Config()
const courier = new Courier('https://example.com', 10000)

// 创建操作员
const operator = new Operator(1, 'username', 'password', courier, config)

// 更新科研等级数据
await operator.updateResearch()

// 获取id=114514的研究等级
const level = operator.elements.get(114514)
// 获取研究队列
const queue = operator.queues.research
// 如果研究114514的等级小于10，且研究队列中研究114514的最后一个值小于10，则从id=1的星球升级1级
if (level < 10 && queue.getLastCount(114514) < 10) {
  operator.buildResearch(1, 114514, 1)
}
