import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AliasOptions, Plugin } from 'vite'

export type ShopifyDebuggerViteOptions = {
  /** Enable the alias. Defaults to SHOPIFY_DEBUGGER=true or SHOPIFY_APP_BRIDGE_DEBUG=true. */
  enabled?: boolean
  /** Alias @shopify/app-bridge-react to the debugger shim. Defaults to true. */
  aliasAppBridgeReact?: boolean
}

function envEnabled() {
  return process.env.SHOPIFY_DEBUGGER === 'true' || process.env.SHOPIFY_APP_BRIDGE_DEBUG === 'true'
}

function normalizeAlias(alias: AliasOptions | undefined) {
  if (!alias) return []
  return Array.isArray(alias) ? alias : Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))
}

export function shopifyDebugger(options: ShopifyDebuggerViteOptions = {}): Plugin {
  const enabled = options.enabled ?? envEnabled()
  const aliasAppBridgeReact = options.aliasAppBridgeReact ?? true
  const debuggerRoot = path.dirname(fileURLToPath(import.meta.url))
  const shimPath = path.resolve(debuggerRoot, 'app-bridge-react.js')

  return {
    name: 'shopify-debugger',
    enforce: 'pre',
    config(config) {
      if (!enabled || !aliasAppBridgeReact) return

      return {
        resolve: {
          alias: [
            { find: '@shopify/app-bridge-react', replacement: shimPath },
            ...normalizeAlias(config.resolve?.alias),
          ],
        },
      }
    },
  }
}

export default shopifyDebugger
