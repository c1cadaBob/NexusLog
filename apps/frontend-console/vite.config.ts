import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 开发代理目标支持环境变量覆盖，兼容「本机运行」和「容器内运行」两种模式
  const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8080'
  // ingest 接口在 M2 阶段由 control-plane 提供，默认与 api 目标一致以兼容本机直连
  const ingestProxyTarget = process.env.VITE_DEV_INGEST_PROXY_TARGET || apiProxyTarget
  // agent 拉取接口由 collector-agent 提供，默认回退到本机 9091
  const agentProxyTarget = process.env.VITE_DEV_AGENT_PROXY_TARGET || 'http://localhost:9091'
  // 支持覆盖 Vite 缓存目录，避免容器/主机混跑时 node_modules/.vite 权限冲突
  const viteCacheDir = process.env.VITE_CACHE_DIR || 'node_modules/.vite'
  const wsProxyTarget =
    process.env.VITE_DEV_WS_PROXY_TARGET ||
    apiProxyTarget.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')

  return {
    cacheDir: viteCacheDir,
    plugins: [
      react(),
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240,
      }),
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
      }),
    ],
    css: {
      postcss: './postcss.config.js',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      cors: true,
      hmr: {
        overlay: true,
      },
      fs: {
        strict: true,
        allow: [path.resolve(__dirname)],
      },
      proxy: {
        // 优先匹配 ingest，避免被通用 /api 代理吞掉
        '/api/v1/ingest': {
          target: ingestProxyTarget,
          changeOrigin: true,
        },
        '/agent/v1': {
          target: agentProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: wsProxyTarget,
          ws: true,
        },
      },
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: mode !== 'production',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-antd': ['antd'],
            'vendor-echarts': ['echarts'],
          },
        },
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  }
})
