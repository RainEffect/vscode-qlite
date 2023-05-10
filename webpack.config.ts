import { Configuration } from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';

/** 基础配置信息 */
const baseConfig: Configuration = {
  mode: 'none',
  externals: { vscode: 'commonjs vscode' },
  resolve: {
    extensions: ['.ts', '.js']
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: { level: 'log' },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }]
      }
    ]
  }
};

/** `extension`配置信息 */
const extensionConfig: Configuration = {
  ...baseConfig,
  target: 'node',
  entry: './src/extension.ts',
  externals: ['vscode'],
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  }
};

/** `webview`配置信息 */
const webConfig: Configuration = {
  ...baseConfig,
  target: ['web', 'es2020'],
  experiments: { outputModule: true }
};

const loginConfig: Configuration = {
  ...webConfig,
  entry: './src/webview/login/script.ts',
  output: {
    path: path.resolve(__dirname, 'out', 'webview', 'login'),
    filename: 'script.js',
    libraryTarget: 'module',
    chunkFormat: 'module'
  },
  plugins: [
    // 复制webview运行的组件到输出目录
    new CopyPlugin({
      patterns: [
        {
          from: 'node_modules/@vscode/codicons/dist/codicon.css',
          to: path.join(__dirname, 'out/webview')
        },
        {
          from: 'node_modules/@vscode/codicons/dist/codicon.ttf',
          to: path.join(__dirname, 'out/webview')
        },
        {
          from: 'src/webview',
          to({ absoluteFilename }) {
            return absoluteFilename?.replace('src', 'out') as string;
          },
          globOptions: {
            ignore: ['**/*.ts']
          }
        }
      ]
    })
  ]
};

const chatConfig: Configuration = {
  ...webConfig,
  entry: './src/webview/chat/script.ts',
  output: {
    path: path.resolve(__dirname, 'out', 'webview', 'chat'),
    filename: 'script.js',
    libraryTarget: 'module',
    chunkFormat: 'module'
  }
};

// 导出配置信息
module.exports = [extensionConfig, loginConfig, chatConfig];
