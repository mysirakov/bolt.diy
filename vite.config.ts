import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev'
import UnoCSS from 'unocss/vite'
import { defineConfig, type ViteDevServer } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules'
import tsconfigPaths from 'vite-tsconfig-paths'
import * as dotenv from 'dotenv'

// Load environment variables from multiple files
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
dotenv.config()

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      // Provide a minimal process.env for libs that read it at build time
      'process.env': {},
    },
    build: {
      target: 'esnext',
      sourcemap: false, // avoids noisy sourcemap warnings you saw
    },
    plugins: [
      // ⬇️ Include path in polyfills; do NOT exclude it
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'path'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        // remove 'path' from exclude to ensure the polyfill is used
        exclude: ['child_process', 'fs'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            }
          }
          return null
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    resolve: {
      alias: {
        // ⬇️ Force Node 'path' to browser polyfill to fix "basename not exported" error
        path: 'path-browserify',
      },
    },
    optimizeDeps: {
      // ensure the polyfill is pre-bundled
      include: ['path-browserify'],
    },
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OPENAI_LIKE_API_MODELS',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    // Helpful for container/dev (not used in production runtime server)
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/tests/preview/**', // Exclude preview tests that require Playwright
      ],
    },
  }
})

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./)
        if (raw) {
          const version = parseInt(raw[2], 10)
          if (version === 129) {
            res.setHeader('content-type', 'text/html')
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            )
            return
          }
        }
        next()
      })
    },
  }
}
