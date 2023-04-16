import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs';
import * as path from 'path';

/** 通用配置 */
const baseConfig: esbuild.BuildOptions = {
    bundle: true,
    minify: process.env.NODE_ENV === "production",
    sourcemap: process.env.NODE_ENV !== "production"
};

/** 编译执行文件配置 */
const extensionConfig: esbuild.BuildOptions = {
    ...baseConfig,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    external: ["vscode"]
};

/**
 * 获取copy插件
 * @param watch 是否开启监视
 * @returns copy监视插件实例
 */
function getcopyPlugin(watch: boolean = false): esbuild.Plugin {
    return copy({
        resolveFrom: "cwd",
        assets: {
            from: [
                "./src/webview/**/*.css",
                "./src/webview/**/*.html"
            ],
            to: ["./out/webview"]
        },
        watch: watch
    });
}

/** 编译网页脚本文件配置 */
const webviewConfig: esbuild.BuildOptions = {
    ...baseConfig,
    target: "es2020",
    format: "esm",
    entryPoints: ["./src/webview/login/script.ts"],
    outfile: "./out/webview/login/script.js"
};

/** 监视模式配置 */
const watchConfig: esbuild.BuildOptions = {
    watch: {
        onRebuild(error, result) {
            console.log("[watch] build started");
            if (error) {
                error.errors.forEach((error) =>
                    console.error(
                        `> ${error.location?.file}:${error.location?.line}:${error.location?.column}: error: ${error.text}`
                    )
                );
            } else {
                console.log("[watch] build finished");
            }
        }
    }
};

/**
 * 获取要编译的文件目录，忽略webview目录下的文件
 * @param src 源文件根目录
 * @returns 编译的文件目录列表
 */
function getFiles(src: string = './src'): string[] {
    let srcFiles: string[] = [];
    fs.readdirSync(src).forEach(file => {
        const fullPath = path.join(src, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            if (!fullPath.includes('webview')) {
                // 递归获取下级文件夹的文件目录
                srcFiles.push(...getFiles(fullPath));
            }
        } else if (fullPath.endsWith('.ts')) {
            srcFiles.push(fullPath.substring(4));
        }
    });
    return srcFiles;
}

// 编译脚本
(async () => {
    const args = process.argv.slice(2);
    try {
        if (args.includes("--watch")) { // 监视模式
            console.log("[watch] build started");
            getFiles().forEach(async srcPath => {
                await esbuild.build({
                    ...extensionConfig,
                    ...watchConfig,
                    entryPoints: ["./src/" + srcPath],
                    outfile: "./out/" + srcPath.replace('.ts', '.js')
                });
            });
            await esbuild.build({
                ...webviewConfig,
                ...watchConfig,
                plugins: [getcopyPlugin(true)]
            });
            console.log("[watch] build finished");
        } else { // 编译模式
            getFiles().forEach(async srcPath => {
                await esbuild.build({
                    ...extensionConfig,
                    entryPoints: ["./src/" + srcPath],
                    outfile: "./out/" + srcPath.replace('.ts', '.js')
                });
            });
            await esbuild.build({
                ...webviewConfig,
                plugins: [getcopyPlugin()]
            });
            console.log("build complete");
        }
    } catch (err: any) {
        process.stderr.write(err.stderr);
        process.exit(1);
    }
})();
