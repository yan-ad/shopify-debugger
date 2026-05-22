import { shopifyDebugger } from './bridge'

export function useAppBridge() {
  return shopifyDebugger
}

export const Provider = ({ children }: { children?: unknown }) => children
export const AppBridgeProvider = Provider

export { shopifyDebugger }
export type {
  ResourcePickerMode,
  ResourcePickerResponse,
  ShopifyDebuggerBridge,
  ShopifyDebuggerEvent,
  ShopifyDebuggerState,
} from './bridge'
