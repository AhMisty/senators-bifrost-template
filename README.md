<div align="center">
  <h1>Bifrost Template</h1>
  <img src="https://raw.githubusercontent.com/AhMisty/senators-bifrost-template/main/assets/logo.svg" alt="Bifrost Template" width="30%" />

[![npm version](https://img.shields.io/npm/v/@senators/bifrost-template.svg?style=flat-square)](https://www.npmjs.com/package/@senators/bifrost-template)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://github.com/AhMisty/senators-bifrost-template/blob/main/LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/@senators/bifrost-template.svg?style=flat-square)](https://www.npmjs.com/package/@senators/bifrost-template)

<span style="color: #999">English</span> | [中文](https://github.com/AhMisty/senators-bifrost-template/blob/main/docs/zh-CN/README.md)
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/AhMisty/senators-bifrost-template/main/assets/editor-demo.svg" alt="Animated TypeScript editor demonstrating the Bifrost SDK API" width="1200" />
</p>

The animation shows a Bifrost SDK snippet; complete scripts with error handling are in `src/example/`.

## ✨ Bifrost script template

An ESM TypeScript template for the New-Star HTTP protocol, using [Bifrost](https://github.com/AhMisty/senators-bifrost).

## ⚡ Start

Create a project from this GitHub template or clone the repository. Use Node.js 26 or later.

```sh
git clone https://github.com/AhMisty/senators-bifrost-template.git
cd senators-bifrost-template
npm install
```

Copy `src/example/base.ts`, or another complete script from `src/example/`, into `src/index.ts`. Configure its account and targets; `baseUrl` must name the game installation directory ending in `/`. Credentials are placeholders and can be read from the process environment. Then run:

```sh
npm start
```

`npm start` runs `src/index.ts` directly. The default entry contains only `void 0` and exits without output or requests. Running or importing an example starts its requests.

### npm source archive

The npm archive contains `src/`, `README.md`, `LICENSE` and `package.json`. Images and other guides use GitHub links.

```sh
npm pack @senators/bifrost-template
```

Extract it and copy a complete script from `package/src/example/` into your ESM project's `src/index.ts`. Run `npm install @senators/bifrost`, configure the script and execute `node src/index.ts`. Use the GitHub template or clone for the complete project with tests and tooling configuration.

### TLS certificates

Bifrost uses Node.js `fetch` by default and has no `rejectUnauthorized` or `ignoreSSL` option. For a trusted test server with an invalid certificate, put this in the application's entry point before the first HTTPS request:

```ts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
```

This changes TLS verification process-wide, affecting other sessions and HTTPS clients that use Node.js defaults. Use it temporarily in a trusted test environment; do not put it inside a shared library.

For normal use, provide a valid server certificate. For a private CA, set `NODE_EXTRA_CA_CERTS` to its PEM file before starting Node.js; assigning it through `process.env` after startup has no effect. See [Node.js TLS environment variables](https://nodejs.org/download/release/v26.7.0/docs/api/cli.html#node_tls_reject_unauthorizedvalue).

## 🧩 Examples

| Script                                                                                             | Behavior                                                                     |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [base](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/base.ts)         | Log in explicitly and query the selected planet's buildings                  |
| [building](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/building.ts) | Request one building level when below the target                             |
| [research](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/research.ts) | Request one research level when below the target                             |
| [shipyard](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/shipyard.ts) | Request the shortfall after subtracting inventory and remaining queued units |
| [fleet](https://github.com/AhMisty/senators-bifrost-template/blob/main/src/example/fleet.ts)       | Repeat an expedition round, waiting 10 minutes after each round              |

Each example confirms login. Supply valid IDs and fleet settings, and nonnegative safe integers for target levels and quantities. Scripts do not validate configuration or estimate resources; the server checks resources and limits.

Errors print a category and may include a known local reason or a server code of up to three digits, such as `server:planet-mismatch` or `server:503`. Output omits server text, raw responses and tokens.

### Single-run scripts

Base, building, research and shipyard run once. They check the returned page and planet; upgrade and production also require the target catalogue entry. A failed initial read prevents submission. After a submission attempt, upgrade and production read once more, even if submission throws, without retrying the write. Login or read failures exit with a nonzero status.

Building and research skip elements already queued, including building dismantling. Research levels belong to the account; the selected planet provides resources. Their readback confirms either a level at least one higher than before, or a queue entry for the same element at exactly that next level. Shipyard confirms that inventory plus remaining queued units reaches the target count.

Upgrade and production results include the initial level or inventory, the initial queue state, and `status`: `skipped` when no write is needed, `confirmed` when readback meets the condition, or `mismatch` otherwise. Success and normal skips both produce output; `mismatch` is a result rather than a process error. Confirmation checks acceptance or effect without waiting for construction to finish.

### Fleet

Fleet runs sequential expedition rounds and waits 10 minutes after every round, including initial login failures, request errors and uncertain dispatch outcomes. Press `Ctrl+C` to stop. `stayOption: 1` is a destination-form option, not a duration in seconds.

Each round reads `fleetTable` before dispatch and again after the attempt, including dispatch errors. A failed initial read prevents dispatch. A decoded dispatch receipt must match the requested origin, destination coordinates, mission and ship quantities. Confirmation then requires exactly one new, non-null fleet ID whose visible coordinates, mission text, total ships and times match the receipt.

Output contains `status` and `fleetId`: `confirmed` includes the matched ID; a receipt contradicting the request gives `mismatch`; missing or ambiguous evidence gives `unverified`. Unconfirmed results set `fleetId` to `null`. Readback confirms an active dispatch without waiting for its return.

`autoLogin` logs in when needed and retries the current request once after explicit session expiry. Reauthentication does not restore draft tokens; a rejected draft ends the round, and the next round creates another. Verification only reads state; it does not resubmit dispatch to establish an outcome.

The activity list lacks cargo, body type, ship-type IDs and a request correlation ID. Concurrent dispatches with identical visible details cannot be attributed strictly. Across all scripts, observing the expected state is not a transaction guarantee; check uncertain outcomes in the game.

For other pages, actions, calculations, authentication and transport options, see the [Bifrost guide](https://github.com/AhMisty/senators-bifrost).

## 🛠️ Development

Use the complete GitHub checkout for development. Node.js runs TypeScript directly without a build step. Type checking uses `NodeNext` module resolution for `src/` and `tests/`. Direct runtime and development dependencies use `^` compatible version ranges; lockfiles are ignored by git.

| Command                   | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `node --run check`        | Run lint with fixes, format files, then run tests.                         |
| `node --run test`         | Run the TypeScript tests in `tests/` with `node:test`.                     |
| `node --run start`        | Run `src/index.ts` directly.                                               |
| `node --run test:package` | Check package contents, source imports and runtime dependencies.           |
| `node --run prepack`      | Run `check`, then the package checks.                                      |
| `node --run release`      | Run `npm publish --access public`, which runs `prepack` before publishing. |

Package checks verify published files and source imports: relative imports must name packaged files, and external imports must use declared runtime dependencies or Node.js built-ins.

Tests require 100% line, branch and function coverage across `src/**`, using simulated HTTP responses and timers without game requests. Update the tests when replacing the empty entry or changing a script.

CI runs `npm run check` and `npm run test:package` on Node.js 26 and requires the working tree to remain unchanged.

## 📜 License

Licensed under the [MIT License](https://github.com/AhMisty/senators-bifrost-template/blob/main/LICENSE).

## 🤝 Contributing

Issues and pull requests are welcome. Keep code, types, examples and both language guides aligned with the protocol Bifrost implements.

---

<div align="center">
  <p>Powered by <a href="https://github.com/AhMisty/senators-bifrost">Bifrost</a> | © 2026 AhMisty</p>
</div>
