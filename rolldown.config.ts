import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig([
  {
    input: './src/main.ts',
    platform: 'node',
    plugins: [
      dts({
        sourcemap: true,
        oxc: true,
      }),
    ],
    output: [
      {
        dir: './out',
        minify: true,
        cleanDir: true,
      },
    ],
  },
])
