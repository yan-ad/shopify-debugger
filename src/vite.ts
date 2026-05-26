import type { AliasOptions, Plugin } from "vite";
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

export function shopifyDebugger(
  options: ShopifyDebuggerViteOptions = {},
): Plugin {
  const enabled = options.enabled ?? envEnabled();
  const aliasAppBridgeReact = options.aliasAppBridgeReact ?? true;
  const debuggerRoute = normalizeRoute(options.debuggerRoute);
  const shimPath = "shopify-debugger/app-bridge-react";

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
      if (!enabled || !debuggerRoute) return;

      server.middlewares.use((request, response, next) => {
        const requestUrl = request.url?.split("?")[0];
        const normalizedUrl =
          requestUrl?.endsWith("/") && requestUrl !== "/" ?
            requestUrl.slice(0, -1)
          : requestUrl;

        if (normalizedUrl !== debuggerRoute) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          renderDebuggerPage({
            appUrl: options.appUrl ?? "/",
            title: options.title,
          }),
        );
      });
    },
  };
}

export default shopifyDebugger;
