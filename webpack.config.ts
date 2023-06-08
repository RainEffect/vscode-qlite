/**
 * # 此项目通过webpack进行编译和打包，输出文件目录及对应说明如下：
 *
 * out
 * |--extension.js -- 主程序文件，扩展加载入口
 * |--codicon.css -- 公共图标资源，用于加载页面的图标
 * |--codicon.ttf -- 上一个文件需要的字体文件
 * |--chat -- 聊天页面
 * |--|--index.html -- 网页
 * |--|--script.js -- 脚本
 * |--|--style.css -- 样式
 * |--login -- 登录页面
 * |--|--index.html
 * |--|--script.js
 * |--|--style.css
 *
 * `chat`和`login`分别是加载各个页面的资源包，都包含相同名称的`html`、`js`、`css`文件
 *
 * > 除了`codicon`，其它文件都经过压缩，不可读，调试以源码为准
 */
import CopyPlugin from 'copy-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { readdirSync } from 'fs';
import HtmlPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { join, resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { Configuration } from 'webpack';

/** 源代码目录的绝对路径 */
const srcDir = resolve(__dirname, 'src');
/** 打包代码目录的绝对路径 */
const outDir = resolve(__dirname, 'out');
/** 图标资源文件目录 */
const codiconDir = join('node_modules', '@vscode', 'codicons', 'dist');

/** 通用配置 */
const baseConfig: Configuration = {
  infrastructureLogging: { level: 'log' },
  resolve: { extensions: ['.ts', '.js'] }
};

/** 扩展主程序配置 */
const extensionConfig: Configuration = {
  ...baseConfig,
  target: 'node',
  entry: './src/extension.ts',
  module: {
    rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }]
  },
  output: {
    path: outDir,
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: { vscode: 'commonjs vscode' },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ extractComments: false })]
  },
  plugins: [
    // 将图标资源文件复制到打包目录
    new CopyPlugin({
      patterns: [
        { from: join(codiconDir, 'codicon.css'), to: outDir },
        { from: join(codiconDir, 'codicon.ttf'), to: outDir }
      ]
    })
  ]
};

/** 页面配置 */
const webviewConfigs: Configuration[] = [];

/** 页面目录表 */
const webDirs: string[] = readdirSync(join(srcDir, 'webview'), {
  withFileTypes: true
})
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

webDirs.forEach((dirname) => {
  /** 页面完整路径 */
  const webDir = join(srcDir, 'webview', dirname);
  webviewConfigs.push({
    ...baseConfig,
    target: ['web', 'es2020'],
    module: {
      rules: [
        { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
        { test: /\.ts$/, exclude: /node_modules/, use: 'ts-loader' }
      ]
    },
    entry: [join(webDir, 'script.ts'), join(webDir, 'style.css')],
    output: {
      path: join(outDir, dirname),
      filename: 'script.js',
      libraryTarget: 'module',
      chunkFormat: 'module'
    },
    experiments: { outputModule: true },
    plugins: [
      new HtmlPlugin({
        template: join(webDir, 'index.html'),
        filename: 'index.html',
        minify: true,
        inject: false
      }),
      new MiniCssExtractPlugin({ filename: 'style.css' })
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new CssMinimizerPlugin(),
        new TerserPlugin({ extractComments: false })
      ]
    }
  });
});

export default [extensionConfig, ...webviewConfigs];
