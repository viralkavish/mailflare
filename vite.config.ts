// Modified for VDesai Mail (https://github.com/viralkavish/mailflare) on 2026-11-23 under GNU AGPL-3.0
import fs from "node:fs";
import { defineConfig, lazyPlugins } from "vite-plus";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import lintConfig from "./lint.config";

function resolvePublicTurnstileSiteKey(): string {
	if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
	try {
		const raw = fs.readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
		const match = raw.match(/"NEXT_PUBLIC_TURNSTILE_SITE_KEY"\s*:\s*"([^"]+)"/);
		return match?.[1] ?? "";
	} catch {
		return "";
	}
}

const publicTurnstileSiteKey = resolvePublicTurnstileSiteKey();
if (publicTurnstileSiteKey && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
	process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = publicTurnstileSiteKey;
}

export default defineConfig({
	define: publicTurnstileSiteKey
		? { "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY": JSON.stringify(publicTurnstileSiteKey) }
		: undefined,
	// Keep the existing source formatting while adopting Vite+ checks.
	check: { fmt: false },
	lint: { ...lintConfig, options: { typeAware: true, typeCheck: true } },
	resolve: {
		// css-tree's ESM build loads ../data/patch.json through createRequire, which workerd cannot resolve; the dist bundle inlines it.
		alias: [{ find: /^css-tree$/, replacement: "css-tree/dist/csstree.esm" }],
	},
	server: { allowedHosts: ["mailflare.local", "mail.dev"] },
	plugins: lazyPlugins(() => [
		vinext({ images: { optimizer: imagesOptimizer() } }),
		cloudflare({
			// Browser tests can use disposable storage without resetting the local demo database.
			persistState: process.env.MAILFLARE_TEST_STATE_PATH ? { path: process.env.MAILFLARE_TEST_STATE_PATH } : true,
			remoteBindings: process.env.CLOUDFLARE_REMOTE_BINDINGS === "true",
			viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
		}),
	]),
});
