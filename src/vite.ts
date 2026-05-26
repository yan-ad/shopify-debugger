import type { AliasOptions, Plugin } from "vite";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderDebuggerPage } from "./debugger-page";

export type ShopifyDebuggerViteOptions = {
  /** Enable the alias. Defaults to SHOPIFY_DEBUGGER=true or SHOPIFY_APP_BRIDGE_DEBUG=true. */
  enabled?: boolean;
  /** Alias @shopify/app-bridge-react to the debugger shim. Defaults to true. */
  aliasAppBridgeReact?: boolean;
  /** Register a local debugger shell route. Defaults to true. */
  debuggerRoute?: boolean | string;
  /** App URL loaded inside the debugger iframe. Defaults to '/'. */
  appUrl?: string;
  /** Debugger page title. */
  title?: string;
};

function envEnabled() {
  return (
    process.env.SHOPIFY_DEBUGGER === "true" ||
    process.env.SHOPIFY_APP_BRIDGE_DEBUG === "true"
  );
}

function normalizeAlias(alias: AliasOptions | undefined) {
  if (!alias) return [];
  return Array.isArray(alias) ? alias : (
      Object.entries(alias).map(([find, replacement]) => ({
        find,
        replacement,
      }))
    );
}

function normalizeRoute(route: boolean | string | undefined) {
  if (route === false) return undefined;
  if (typeof route === "string")
    return route.startsWith("/") ? route : `/${route}`;
  return "/_debugger";
}

function resolveAppBridgeShimPath() {
  const candidates = [
    fileURLToPath(new URL("./app-bridge-react.ts", import.meta.url)),
    fileURLToPath(new URL("./app-bridge-react.js", import.meta.url)),
    fileURLToPath(new URL("./app-bridge-react.mjs", import.meta.url)),
    fileURLToPath(new URL("../src/app-bridge-react.ts", import.meta.url)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveDebuggerShellEntryPath() {
  const candidates = [
    fileURLToPath(new URL("./debugger-shell.tsx", import.meta.url)),
    fileURLToPath(new URL("../src/debugger-shell.tsx", import.meta.url)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "'":
        return "&#39;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function renderReactDebuggerPage(options: {
  title?: string;
  appUrl?: string;
  shellEntryPath: string;
}) {
  const title = options.title ?? "Shopify Debugger";
  const appUrl = options.appUrl ?? "/";
  const escapedTitle = escapeHtml(title);
  const shellEntryPath = options.shellEntryPath.replace(/\\/g, "/");
  const shellEntryUrl = `/@fs${encodeURI(shellEntryPath)}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="shopify-api-key" content="SHOPIFY_API_KEY" />
  <title>${escapedTitle}</title>
  <script type="module" src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.__SHOPIFY_DEBUGGER_INITIAL_APP_URL = ${JSON.stringify(appUrl)};
  </script>
  <script type="module" src="${shellEntryUrl}"></script>
</body>
</html>`;
}

export function shopifyDebugger(
  options: ShopifyDebuggerViteOptions = {},
): Plugin {
  const enabled = options.enabled ?? envEnabled();
  const aliasAppBridgeReact = options.aliasAppBridgeReact ?? true;
  const debuggerRoute = normalizeRoute(options.debuggerRoute);
  const shimPath =
    resolveAppBridgeShimPath() || "shopify-debugger/app-bridge-react";

  return {
    name: "shopify-debugger",
    enforce: "pre",
    config(config) {
      if (!enabled || !aliasAppBridgeReact) return;

      return {
        resolve: {
          alias: [
            { find: "@shopify/app-bridge-react", replacement: shimPath },
            ...normalizeAlias(config.resolve?.alias),
          ],
        },
      };
    },
    configureServer(server) {
      const shellEntryPath = resolveDebuggerShellEntryPath();

      if (enabled && debuggerRoute) {
        const logger = server.config.logger;
        const originalInfo = logger.info.bind(logger);
        let debugUrlLogged = false;

        logger.info = (message, options) => {
          if (
            !debugUrlLogged &&
            typeof message === "string" &&
            message.includes("press h + enter to show help")
          ) {
            const localUrl = server.resolvedUrls?.local[0];
            if (localUrl) {
              const debugUrl = new URL(debuggerRoute, localUrl).toString();
              originalInfo(`  ➜  Debug:   ${debugUrl}`, options);
              debugUrlLogged = true;
            }
          }

          return originalInfo(message, options);
        };
      }

      if (!enabled || !debuggerRoute) return;

      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url?.split("?")[0];
        const normalizedUrl =
          requestUrl?.endsWith("/") && requestUrl !== "/" ?
            requestUrl.slice(0, -1)
          : requestUrl;

        if (normalizedUrl !== debuggerRoute) {
          next();
          return;
        }
        try {
          const html =
            shellEntryPath ?
              renderReactDebuggerPage({
                appUrl: options.appUrl ?? "/",
                title: options.title,
                shellEntryPath,
              })
            : renderDebuggerPage({
                appUrl: options.appUrl ?? "/",
                title: options.title,
              });

          const transformed = await server.transformIndexHtml(
            request.url || debuggerRoute,
            html,
          );

          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(transformed);
        } catch (error) {
          next(error as Error);
        }
      });
    },
  };
}

export default shopifyDebugger;
