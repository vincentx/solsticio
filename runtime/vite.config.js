import {defineConfig} from 'vite'
import * as path from 'path'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/main.ts'),
            name: 'main',
            fileName: (format) => `main.${format}.js`
        },
        rollupOptions: {
            plugins: [typescript()]
        }
    }
})
