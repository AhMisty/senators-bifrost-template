import { defineConfig } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export default defineConfig([
  {
    input: './src/main.ts',
    treeshake: true,
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
        format: 'esm',
        minify: true,
        legalComments: 'none',
        sourcemap: false,
      },
    ],
  },
])
