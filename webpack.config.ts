import * as webpack from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';

/** 基础配置信息 */
const baseConfig: webpack.Configuration = {
  mode: 'none',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log'
  },
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
const extensionConfig: webpack.Configuration = {
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
const webviewConfig: webpack.Configuration = {
  ...baseConfig,
  target: ['web', 'es2020'],
  entry: './src/webview/login/script.ts',
  experiments: { outputModule: true },
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
          from: 'src/webview',
          to({ absoluteFilename }) {
            return absoluteFilename?.replace(
              'src/webview',
              'out/webview'
            ) as string;
          },
          globOptions: {
            ignore: ['**/*.ts']
          }
        }
      ]
    })
  ]
};

// 导出配置信息
module.exports = [extensionConfig, webviewConfig];
