import {defineConfig} from 'vite'
import * as path from 'path'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/main.ts'),
            name: 'solstice-runtime',
            fileName: (format) => `solstice-runtime.${format}.js`
        },
        rollupOptions: {
            plugins: [typescript()]
        }
    }
})
