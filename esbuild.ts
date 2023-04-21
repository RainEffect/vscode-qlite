import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs';
import * as path from 'path';

/** 通用配置 */
const baseConfig: esbuild.BuildOptions = {
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production'
};

/** 编译执行文件配置 */
const extensionConfig: esbuild.BuildOptions = {
  ...baseConfig,
  platform: 'node',
  mainFields: ['module', 'main'],
  format: 'cjs',
  external: ['vscode']
};

/** 编译网页脚本文件配置 */
const webviewConfig: esbuild.BuildOptions = {
  ...baseConfig,
  target: 'es2020',
  format: 'esm'
};

/** 监视模式配置 */
const watchConfig: esbuild.BuildOptions = {
  watch: {
    onRebuild(error, result) {
      console.log('[watch] build started');
      if (error) {
        error.errors.forEach((error) =>
          console.error(
            `> ${error.location?.file}:${error.location?.line}:${error.location?.column}: error: ${error.text}`
          )
        );
      } else {
        console.log('[watch] build finished');
      }
    }
  }
};

/**
 * 获取`copy`插件
 * @param watch 是否开启监视
 * @returns 插件实例
 */
function getcopyPlugin(watch: boolean = false): esbuild.Plugin {
  return copy({
    resolveFrom: 'cwd',
    assets: {
      from: ['./src/webview/**/*.css', './src/webview/**/*.html'],
      to: ['./out/webview']
    },
    watch: watch
  });
}

/**
 * 获取对应目录下的所有ts文件
 * @param src 要查询的根目录，默认为`./src`
 * @param isWeb 是否只查询`webview`目录中的文件，默认为`false`
 * @returns 查询到的所有ts文件地址
 */
function getFiles(src: string = './src', isWeb: boolean = false): string[] {
  const files: string[] = [];
  for (const file of fs.readdirSync(src)) {
    const filePath = path.join(src, file);
    if (isWeb === filePath.includes('webview')) {
      if (fs.statSync(filePath).isDirectory()) {
        files.push(...getFiles(filePath, isWeb));
      } else if (filePath.endsWith('.ts')) {
        files.push(filePath);
      }
    }
  }
  return files;
}

// 编译脚本
(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--watch')) {
      // 监视模式
      console.log('[watch] build started');
      await esbuild.build({
        ...extensionConfig,
        ...watchConfig,
        entryPoints: getFiles(),
        outdir: './out'
      });
      await esbuild.build({
        ...webviewConfig,
        ...watchConfig,
        entryPoints: getFiles(undefined, true),
        outdir: './out/webview',
        plugins: [getcopyPlugin()]
      });
      console.log('[watch] build finished');
    } else {
      // 编译模式
      await esbuild.build({
        ...extensionConfig,
        entryPoints: [...getFiles()],
        outdir: './out'
      });
      await esbuild.build({
        ...webviewConfig,
        entryPoints: getFiles(undefined, true),
        outdir: './out/webview',
        plugins: [getcopyPlugin()]
      });
      console.log('build complete');
    }
  } catch (err: any) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})();
