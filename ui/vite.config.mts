import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEnterpriseBuild = fs.existsSync(path.join(__dirname, "app", "enterprise"));

function unwrapCssLayers(css: string): string {
	// 1. 移除裸 @layer 声明列表语句: @layer theme, base, components, utilities;
	let result = css.replace(/@layer\s+[\w\s,-]+;/g, "");

	// 2. 括号匹配展开 @layer <name> { ... } 外壳
	let i = 0;
	while (true) {
		const layerIdx = result.indexOf("@layer", i);
		if (layerIdx === -1) break;

		const openBraceIdx = result.indexOf("{", layerIdx);
		const semicolonIdx = result.indexOf(";", layerIdx);

		if (semicolonIdx !== -1 && (openBraceIdx === -1 || semicolonIdx < openBraceIdx)) {
			result = result.slice(0, layerIdx) + result.slice(semicolonIdx + 1);
			continue;
		}

		if (openBraceIdx === -1) break;

		let depth = 1;
		let closeBraceIdx = openBraceIdx + 1;
		let inString: string | null = null;

		while (closeBraceIdx < result.length && depth > 0) {
			const char = result[closeBraceIdx];
			if (inString) {
				if (char === "\\") {
					closeBraceIdx += 2;
					continue;
				}
				if (char === inString) {
					inString = null;
				}
			} else if (char === '"' || char === "'") {
				inString = char;
			} else if (char === "{") {
				depth++;
			} else if (char === "}") {
				depth--;
			}
			if (depth === 0) break;
			closeBraceIdx++;
		}

		if (depth === 0) {
			const layerContent = result.slice(openBraceIdx + 1, closeBraceIdx);
			result = result.slice(0, layerIdx) + layerContent + result.slice(closeBraceIdx + 1);
			i = layerIdx;
		} else {
			i = layerIdx + 6;
		}
	}

	return result;
}

// 适配 Chrome 90：剥离 CSS 中的 @layer 外壳，避免 Chromium 90 因不识别 @layer 而丢弃整块样式
function flattenCssLayersPlugin() {
	return {
		name: "vite-plugin-flatten-css-layers",
		enforce: "post" as const,
		generateBundle(_options: any, bundle: any) {
			for (const fileName in bundle) {
				const chunk = bundle[fileName];
				if (chunk.type === "asset" && fileName.endsWith(".css")) {
					const rawCss = typeof chunk.source === "string" ? chunk.source : chunk.source.toString();
					chunk.source = unwrapCssLayers(rawCss);
				}
			}
		},
	};
}


export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			routesDirectory: "./app",
			generatedRouteTree: "./app/routeTree.gen.ts",
			// All routes live in layout.tsx files. page.tsx files are pure view
			// components imported by their sibling layout.tsx (Next-style mental
			// model preserved for content, but routing config lives in one place).
			routeToken: "layout",
			// Treat ONLY layout.tsx / __root.tsx as routes; everything else under app/
			// (page.tsx, views, components, helpers) is ignored.
			// Directory entries have no extension and are not matched, so recursion still works.
			routeFileIgnorePattern: "^(?!layout\\.tsx$|__root\\.tsx$).+\\.(tsx|ts|jsx|js)$",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
		flattenCssLayersPlugin(),
	],
	resolve: {
		// Enterprise UI source is symlinked into ./app/enterprise; preserving symlinks
		// keeps module resolution rooted here so deps like zod / @phosphor-icons/react
		// resolve against this ui/node_modules rather than the symlink target's tree.
		preserveSymlinks: true,
		alias: {
			"@": path.resolve(__dirname),
			"@enterprise": isEnterpriseBuild
				? path.resolve(__dirname, "app", "enterprise")
				: path.resolve(__dirname, "app", "_fallbacks", "enterprise"),
			"@schemas": isEnterpriseBuild
				? path.resolve(__dirname, "app", "enterprise", "lib", "schemas")
				: path.resolve(__dirname, "app", "_fallbacks", "enterprise", "lib", "schemas"),
		},
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
		"process.env.BIFROST_IS_ENTERPRISE": JSON.stringify(isEnterpriseBuild ? "true" : "false"),
		"process.env.BIFROST_DISABLE_PROFILER": JSON.stringify(process.env.BIFROST_DISABLE_PROFILER ?? ""),
		"process.env.BIFROST_ENTERPRISE_TRIAL_EXPIRY": JSON.stringify(process.env.ENTERPRISE_TRIAL_EXPIRY ?? ""),
		"process.env.BIFROST_PORT": JSON.stringify(process.env.BIFROST_PORT ?? ""),
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: `http://localhost:${process.env.BIFROST_PORT || "8080"}`,
				changeOrigin: true,
			},
		},
	},
	css: {
		transformer: "lightningcss",
		lightningcss: {
			targets: {
				chrome: 90 << 16,
			},
		},
	},
	build: {
		target: ["es2020", "chrome90"],
		cssTarget: "chrome90",
		cssMinify: "lightningcss",
		outDir: "out",
		emptyOutDir: true,
	},
});
