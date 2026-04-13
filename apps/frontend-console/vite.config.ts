import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 开发代理目标支持环境变量覆盖，兼容「本机运行」和「容器内运行」两种模式
  const apiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8080'
  // ingest 接口在 M2 阶段由 control-plane 提供，默认与 api 目标一致以兼容本机直连
  const ingestProxyTarget = process.env.VITE_DEV_INGEST_PROXY_TARGET || apiProxyTarget
  // query 接口默认独立走 query-api，避免被 api-service 代理吞掉
  const queryProxyTarget = process.env.VITE_DEV_QUERY_PROXY_TARGET || 'http://localhost:8082'
  const controlPlaneProxyTarget = process.env.VITE_DEV_CONTROL_PLANE_PROXY_TARGET || ingestProxyTarget
  // audit-api 审计服务
  const auditProxyTarget = process.env.VITE_DEV_AUDIT_PROXY_TARGET || 'http://localhost:8083'
  // BFF 聚合服务
  const bffProxyTarget = process.env.VITE_DEV_BFF_PROXY_TARGET || 'http://localhost:3001'
  // export-api 导出服务
  const exportProxyTarget = process.env.VITE_DEV_EXPORT_PROXY_TARGET || 'http://localhost:8084'
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
        '/api/v1/ingest': {
          target: ingestProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/query': {
          target: queryProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/alert': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/notification': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/incidents': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/backup': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/metrics': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/resource': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/storage': {
          target: controlPlaneProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/audit': {
          target: auditProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/bff': {
          target: bffProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/export': {
          target: exportProxyTarget,
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
