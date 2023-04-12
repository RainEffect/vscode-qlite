import * as esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs';
import * as path from 'path';

const baseConfig: esbuild.BuildOptions = {
    bundle: true,
    minify: process.env.NODE_ENV === "production",
    sourcemap: process.env.NODE_ENV !== "production"
};

const srcDir = './src';
const srcPaths = fs.readdirSync(srcDir).filter(file => path.extname(file) === '.ts');

const extensionConfig: esbuild.BuildOptions = {
    ...baseConfig,
    platform: "node",
    mainFields: ["module", "main"],
    format: "cjs",
    external: ["vscode"]
};

const webviewConfig: esbuild.BuildOptions = {
    ...baseConfig,
    target: "es2020",
    format: "esm",
    entryPoints: ["./src/webview/login/login.ts"],
    outfile: "./out/webview/login/login.js",
    plugins: [
        copy({
            resolveFrom: "cwd",
            assets: {
                from: ["./src/webview/login/*.css"],
                to: ["./out/webview/login"]
            }
        })
    ]
};

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

// Build script
(async () => {
    const args = process.argv.slice(2);
    try {
        if (args.includes("--watch")) {
            // Build and watch extension and webview code
            console.log("[watch] build started");
            srcPaths.forEach(async srcPath => {
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
            });
            console.log("[watch] build finished");
        } else {
            // Build extension and webview code
            srcPaths.forEach(async srcPath => {
                await esbuild.build({
                    ...extensionConfig,
                    entryPoints: ["./src/" + srcPath],
                    outfile: "./out/" + srcPath.replace('.ts', '.js')
                });
            });
            await esbuild.build(webviewConfig);
            console.log("build complete");
        }
    } catch (err: any) {
        process.stderr.write(err.stderr);
        process.exit(1);
    }
})();
