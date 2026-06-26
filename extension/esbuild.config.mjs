import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const stubsPath = resolve(__dirname, "src/stubs.js");

const opts = {
	entryPoints: ["src/content.ts", "src/background.ts"],
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "chrome120",
	outdir: "dist",
	entryNames: "[name]",
	sourcemap: "linked",
	logLevel: "info",
	alias: {
		"@pixi/app": stubsPath,
		"@pixi/core": stubsPath,
		"@pixi/display": stubsPath,
		"@pixi/filter-blur": stubsPath,
		"@pixi/filter-bulge-pinch": stubsPath,
		"@pixi/filter-color-matrix": stubsPath,
		"@pixi/sprite": stubsPath,
		"gl-matrix": stubsPath,
		"@applemusic-like-lyrics/ttml": resolve(
			__dirname,
			"src/lib/amll-ttml.mjs",
		),
	},
	define: {
		"import.meta.env.DEV": "false",
		"process.env.NODE_ENV": '"production"',
	},
	loader: {
		".css": "text",
	},
};

if (watch) {
	const ctx = await context(opts);
	await ctx.watch();
	console.log("watching...");
} else {
	await build(opts);
	console.log("build done");
}
