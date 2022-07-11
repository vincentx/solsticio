import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/main.ts'),
            name: 'main',
            fileName: (format) => `main.${format}.js`
        },
        rollupOptions: {
            plugins: [typescript()],
            external: ['react', 'react-dom', '@solsticio/runtime'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    '@solsticio/runtime': '@solsticio/runtime'
                }
            }
        }
    }
})
