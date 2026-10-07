<div align="center">
  <h1>Bifrost Template</h1>
  <img src="https://raw.githubusercontent.com/AhMisty/senators-bifrost-template/main/assets/logo.svg" alt="Bifrost Template" width="30%" />

[![npm version](https://img.shields.io/npm/v/@senators/bifrost-template.svg?style=flat-square)](https://www.npmjs.com/package/@senators/bifrost-template)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://github.com/AhMisty/senators-bifrost-template/blob/main/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/@senators/bifrost-template.svg?style=flat-square)](https://www.npmjs.com/package/@senators/bifrost-template)

[English](https://github.com/AhMisty/senators-bifrost-template/blob/main/README.md) | <span style="color: #999">中文</span>
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/AhMisty/senators-bifrost-template/main/assets/editor-demo.svg" alt="展示 Bifrost SDK 接口的 TypeScript 编辑器动画" width="1200" />
</p>

动画展示 Bifrost SDK 片段；包含错误处理的完整脚本位于 `src/example/`。

## ✨ Bifrost 脚本模板

基于 [Bifrost](https://github.com/AhMisty/senators-bifrost) 的 ESM TypeScript 模板，用于访问 New-Star HTTP 协议。

## ⚡ 开始使用

从 GitHub 模板创建工程，或克隆仓库。使用 Node.js 26 或更高版本。

```sh
git clone https://github.com/AhMisty/senators-bifrost-template.git
cd senators-bifrost-template
npm install
```

将 `src/example/base.ts` 或 `src/example/` 中的其他完整脚本复制到 `src/index.ts`。配置脚本中的账号和目标；`baseUrl` 必须是以 `/` 结尾的游戏安装目录。凭据仅为占位值，可从进程环境读取。然后运行：

```sh
npm start
```

`npm start` 直接执行 `src/index.ts`。默认入口仅包含 `void 0`，执行后退出，没有输出或请求。运行或导入示例即会发起请求。

### npm 源码包

npm 源码包包含 `src/`、`README.md`、`LICENSE` 和 `package.json`。图片与其他指南使用 GitHub 链接。

```sh
npm pack @senators/bifrost-template
```

解压后，将 `package/src/example/` 中的完整脚本复制到自己的 ESM 项目的 `src/index.ts`。运行 `npm install @senators/bifrost`，配置脚本后执行 `node src/index.ts`。包含测试和工具配置的完整工程，请使用 GitHub 模板或克隆仓库。

### TLS 证书

Bifrost 默认使用 Node.js `fetch`，不提供 `rejectUnauthorized` 或 `ignoreSSL` 选项。受信任测试服务器的证书无效时，可在应用入口、首次 HTTPS 请求前设置：

```ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
```

这会改变整个 Node.js 进程的 TLS 校验策略，影响使用 Node.js 默认设置的其他会话和 HTTPS 客户端。仅在受信任测试环境中临时使用，不应写入共享库内部。

常规使用应配置有效的服务端证书。私有 CA 可在启动 Node.js 前将 `NODE_EXTRA_CA_CERTS` 设为其 PEM 文件路径；启动后通过 `process.env` 赋值无效。详见 [Node.js TLS 环境变量](https://nodejs.org/download/release/v26.7.0/docs/api/cli.html#node_tls_reject_unauthorizedvalue)。

## 🧩 示例

| 脚本                                                                                               | 行为                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [base](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/base.ts)         | 显式登录并查询所选星球的建筑                     |
| [building](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/building.ts) | 对低于目标的建筑请求追加一级                     |
| [research](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/research.ts) | 对低于目标的科研请求追加一级                     |
| [shipyard](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/shipyard.ts) | 从目标数量中减去库存与队列剩余数量，请求补造差额 |
| [fleet](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/fleet.ts)       | 循环执行探险，每轮结束后等待 10 分钟             |

各示例确认登录成功。请提供有效 ID 与舰队配置，目标等级和数量须为非负安全整数。脚本不校验配置或预估资源，资源和限制由服务端检查。

错误输出分类，可附上已知的本地原因或至多三位的服务端数字码，例如 `server:planet-mismatch` 或 `server:503`。输出不包含服务端文本、原始响应或令牌。

### 单次脚本

base、building、research 和 shipyard 执行一次，检查返回的页面与星球；升级和生产还要求目录包含目标条目。预读失败时不提交。尝试提交后，升级和生产都会再回读一次，提交抛错也不例外，不重试写入。登录或读取失败时以非零状态退出。

建筑与科研跳过已排队的元素，包括建筑拆除条目。科研等级属于账号，所选星球提供资源。回读等级至少增加一级，或同元素队列中出现恰好下一级的条目，即可确认。造船则确认库存与队列剩余数量之和达到目标数量。

升级与生产的结果包含初始等级或库存、初始队列状态和 `status`：无需写入时为 `skipped`，回读满足条件时为 `confirmed`，否则为 `mismatch`。成功与正常跳过均输出结果；`mismatch` 是结果，不作为进程错误。确认针对入队或生效，不等待建造完成。

### 舰队

fleet 顺序执行探险，每轮结束后等待 10 分钟，包括首次登录失败、请求出错或派遣结果不明的情况。按 `Ctrl+C` 停止。`stayOption: 1` 是目的地表单的选项值，不是秒数。

每轮派遣前读取 `fleetTable`，尝试派遣后再读一次，派遣出错也不例外。预读失败时不派遣。已解析的派遣回执须与请求的起点、目的地坐标、任务和舰船数量一致；随后仅在恰好新增一个非空舰队 ID，且其可见坐标、任务文本、舰船总量和时间均与回执吻合时确认。

输出包含 `status` 和 `fleetId`：`confirmed` 附上匹配的 ID；回执与请求明确不符时为 `mismatch`；证据缺失或有歧义时为 `unverified`。未确认时 `fleetId` 为 `null`。回读确认活动派遣，不等待返航。

`autoLogin` 按需登录，在会话明确过期后重试当前请求一次。重新登录不会恢复草稿令牌；草稿被拒绝时本轮结束，下一轮重新创建。核验仅读取状态，不通过重新派遣确认结果。

活动列表缺少货物、天体类型、舰型 ID 和请求关联 ID，无法严格归因可见信息相同的并发派遣。所有脚本观察到状态达标都不构成事务保证；结果不明时请在游戏中核查。

其他页面、操作、计算函数、认证与传输选项见 [Bifrost 文档](https://github.com/AhMisty/senators-bifrost/blob/main/docs/zh-CN/README.md)。

## 🛠️ 开发

开发时使用完整的 GitHub 仓库。Node.js 直接运行 TypeScript，无需构建。类型检查使用 `NodeNext` 模块解析，涵盖 `src/` 与 `tests/`。直接声明的运行时和开发依赖使用 `^` 兼容版本范围；lockfile 由 git 忽略。

| 命令                      | 用途                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `node --run check`        | 执行 lint 并修复、格式化文件，再运行测试。                     |
| `node --run test`         | 使用 `node:test` 运行 `tests/` 中的 TypeScript 测试。          |
| `node --run start`        | 直接运行 `src/index.ts`。                                      |
| `node --run test:package` | 检查包内容、源码导入与运行时依赖。                             |
| `node --run prepack`      | 先运行 `check`，再检查 npm 包。                                |
| `node --run release`      | 执行 `npm publish --access public`，发布前自动运行 `prepack`。 |

打包检查验证发布文件与源码导入：相对导入须指向包内文件，外部导入须使用已声明的运行时依赖或 Node.js 内置模块。

测试要求 `src/**` 的行、分支和函数覆盖率均为 100%，使用模拟 HTTP 响应与计时器，不请求游戏服务器。替换空入口或修改脚本时，请同步维护测试。

CI 使用 Node.js 26 执行 `npm run check` 和 `npm run test:package`，并要求工作区没有变更。

## 📜 许可证

采用 [MIT 许可证](https://github.com/AhMisty/senators-bifrost-template/blob/main/LICENSE)。

## 🤝 贡献

欢迎提交问题和拉取请求。代码、类型、示例与两种语言的指南都应与 Bifrost 实际实现的协议一致。

---

<div align="center">
  <p>由 <a href="https://github.com/AhMisty/senators-bifrost">Bifrost</a> 驱动 | © 2026 AhMisty</p>
</div>
