import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pkg from "./package.json";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const enforceGetOnlyPlugin = () => {
    return {
        name: "vite-plugin-enforce-get-only",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if (req.url?.startsWith("/dev-api")) {
                    return next();
                }

                if (req.method !== "GET" && req.method !== "OPTIONS" && req.method !== "HEAD") {
                    res.statusCode = 405;
                    res.setHeader("Content-Type", "text/plain");
                    res.end(`Method ${req.method} is not allowed. Only GET requests are accepted.`);
                    return;
                }

                next();
            });
        },
    };
};

export default defineConfig(async () => {
    const analyzePlugins = [];

    if (process.env.ANALYZE === "true") {
        const { visualizer } = await import("rollup-plugin-visualizer");

        analyzePlugins.push(
            visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true }),
        );
    }

    return {
        plugins: [enforceGetOnlyPlugin(), react(), ...analyzePlugins].filter(Boolean),
        optimizeDeps: {
            exclude: ["maplibre-gl"],
        },
        server: {
            proxy: {
                "/dev-api": {
                    target: process.env.VITE_TARGET_API_URL,
                    changeOrigin: true,
                    secure: true,
                    rewrite: (p) => p.replace(/^\/dev-api/, ""),
                },
            },
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
                "@kace_v2": path.resolve(__dirname, "./src_v2"),
                "@kace/core/src/shared/visual-options/sharedVisualOptions.js": resolve(
                    __dirname,
                    "../../packages/kace_cloud_core/src/shared/visual-options/sharedVisualOptions.js",
                ),
                "@kace/core/src/global-config/domain/settings/behaviorNumericRanges.js": resolve(
                    __dirname,
                    "../../packages/kace_cloud_core/src/global-config/domain/settings/behaviorNumericRanges.js",
                ),
                "@kace/ui-shared": resolve(__dirname, "src/components/ui-shared/index.js"),
                "@kace/ui-shared/src/icons": resolve(__dirname, "src/components/ui-shared/src/icons"),
                "@kace/utils": resolve(__dirname, "src/utils/main.js"),
                "@kace/urls": resolve(__dirname, "src/utils/URL.js"),
                "@kace/plugins": resolve(__dirname, "common/plugins/main.js"),
                "@kace/validators": resolve(__dirname, "common/validators/main.js"),
                "@kace/hooks": resolve(__dirname, "src/hooks"),
                "@kace/core": resolve(__dirname, "../../packages/kace_cloud_core"),
            },
        },
        define: {
            "process.env.APPS_DEBUG": JSON.stringify(process.env.APPS_DEBUG),
            __APP_VERSION__: JSON.stringify(pkg.version),
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes("node_modules")) {
                            const pathParts = id.split("/");
                            const packageName = pathParts[pathParts.lastIndexOf("node_modules") + 1];

                            if (packageName.startsWith("@")) {
                                return `${packageName}/${pathParts[pathParts.lastIndexOf("node_modules") + 2]}`;
                            }
                            return packageName;
                        }
                    },
                },
            },
        },
        test: {
            environment: "jsdom",
            globals: true,
            setupFiles: ["./vitest.setup.js"],
            include: ["**/*.{test,spec}.{js,jsx,ts,tsx}"],
            exclude: ["node_modules/**", "**/dist/**", "**/e2e/**"],
            server: {
                deps: {
                    inline: ["@kace/plugins", "@kace/file-extensions", "@kace/error-codes"],
                },
            },
            css: {
                modules: {
                    classNameStrategy: "non-scoped",
                },
            },
        },
    };
});
