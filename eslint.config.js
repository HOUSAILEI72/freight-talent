import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 忽略构建产物、Python 虚拟环境和后端目录
  globalIgnores(['dist', '.venv', 'venv', 'backend', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  // Node.js 环境：构建脚本 + vite 配置使用 process.env 等 Node 全局量
  {
    files: ['vite.config.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // react-refresh 在以下文件中允许混合导出（context、router 等架构文件）
  {
    files: [
      'src/context/*.jsx',
      'src/router/index.jsx',
      'src/components/ui/Toast.jsx',
      'src/components/terminal/AreaSidebar.jsx',
      'src/components/terminal/FunctionRail.jsx',
      'src/pages/jobs/JobsRail.jsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
