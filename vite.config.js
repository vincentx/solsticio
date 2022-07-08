import {defineConfig} from 'vite'
import * as path from 'path'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/main.ts'),
            name:'solstice-runtime',
            fileName: (format) => `solstice-runtime.${format}.js`
        },
        rollupOptions: {

        }
    }
})
