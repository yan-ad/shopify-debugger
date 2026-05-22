export type ShopifyDebuggerEvent = {
  id: string
  type: string
  payload?: unknown
  timestamp: number
}

export type ResourcePickerMode = 'success' | 'cancel' | 'error' | 'manual'

export type ResourcePickerResponse = unknown[] | undefined

export type ShopifyDebuggerState = {
  events: ShopifyDebuggerEvent[]
  resourcePickerMode: ResourcePickerMode
  resourcePickerResponse: ResourcePickerResponse
  pendingResourcePicker?: {
    requestId: string
    options: unknown
    resolve: (value: ResourcePickerResponse) => void
    reject: (error: Error) => void
  }
  activeModals: Set<string>
  loading: boolean
  visibleSaveBars: Set<string>
  lastToast?: {
    message: string
    options?: unknown
  }
}

export type ShopifyDebuggerBridge = ReturnType<typeof createShopifyDebuggerBridge>

let eventSequence = 0

function createEvent(type: string, payload?: unknown): ShopifyDebuggerEvent {
  eventSequence += 1

  return {
    id: `shopify-debugger-event-${eventSequence}`,
    type,
    payload,
    timestamp: Date.now(),
  }
}

const defaultProduct = {
  id: 'gid://shopify/Product/1',
  title: 'Debug Product',
  handle: 'debug-product',
  onlineStoreUrl: 'https://debug-store.myshopify.com/products/debug-product',
  featuredImage: {
    id: 'gid://shopify/ProductImage/1',
    altText: 'Debug product image',
    url: 'https://cdn.shopify.com/s/files/1/0000/0001/products/debug-product.png',
  },
  variants: [
    {
      id: 'gid://shopify/ProductVariant/1',
      title: 'Default Title',
      price: '10.00',
      sku: 'DEBUG-1',
    },
  ],
}

export function createShopifyDebuggerBridge() {
  const listeners = new Set<(event: ShopifyDebuggerEvent, state: ShopifyDebuggerState) => void>()

  const state: ShopifyDebuggerState = {
    events: [],
    resourcePickerMode: 'success',
    resourcePickerResponse: [defaultProduct],
    activeModals: new Set(),
    loading: false,
    visibleSaveBars: new Set(),
  }

  function snapshot(): ShopifyDebuggerState {
    return {
      ...state,
      events: [...state.events],
      activeModals: new Set(state.activeModals),
      visibleSaveBars: new Set(state.visibleSaveBars),
    }
  }

  function notify(event: ShopifyDebuggerEvent) {
    for (const listener of listeners) {
      listener(event, snapshot())
    }
  }

  function emit(type: string, payload?: unknown) {
    const event = createEvent(type, payload)
    state.events = [event, ...state.events].slice(0, 200)
    console.debug('[Shopify Debugger]', type, payload)
    notify(event)
    return event
  }

  function setModalOpen(id: string, open: boolean) {
    if (typeof document === 'undefined') return

    const element = document.getElementById(id)
    if (!element) return

    if (open) {
      element.setAttribute('open', '')
      element.setAttribute('data-shopify-debugger-open', 'true')
    } else {
      element.removeAttribute('open')
      element.removeAttribute('data-shopify-debugger-open')
    }
  }

  function resolveManualResourcePicker(value: ResourcePickerResponse) {
    if (!state.pendingResourcePicker) return false

    const pending = state.pendingResourcePicker
    state.pendingResourcePicker = undefined
    emit('resourcePicker.resolve', { requestId: pending.requestId, value })
    pending.resolve(value)
    return true
  }

  function rejectManualResourcePicker(message = 'Debug resource picker rejected') {
    if (!state.pendingResourcePicker) return false

    const pending = state.pendingResourcePicker
    state.pendingResourcePicker = undefined
    const error = new Error(message)
    emit('resourcePicker.reject', { requestId: pending.requestId, message })
    pending.reject(error)
    return true
  }

  const bridge = {
    modal: {
      show(id: string) {
        state.activeModals.add(id)
        setModalOpen(id, true)
        emit('modal.show', { id })
      },
      hide(id: string) {
        state.activeModals.delete(id)
        setModalOpen(id, false)
        emit('modal.hide', { id })
      },
      toggle(id: string) {
        if (state.activeModals.has(id)) {
          bridge.modal.hide(id)
        } else {
          bridge.modal.show(id)
        }
      },
    },

    toast: {
      show(message: string, options?: unknown) {
        state.lastToast = { message, options }
        emit('toast.show', { message, options })
      },
    },

    async resourcePicker(options: unknown): Promise<ResourcePickerResponse> {
      const requestId = `resource-picker-${Date.now()}-${Math.random().toString(16).slice(2)}`
      emit('resourcePicker.open', { requestId, options, mode: state.resourcePickerMode })

      if (state.resourcePickerMode === 'cancel') {
        emit('resourcePicker.cancel', { requestId })
        return undefined
      }

      if (state.resourcePickerMode === 'error') {
        emit('resourcePicker.error', { requestId })
        throw new Error('Debug resource picker error')
      }

      if (state.resourcePickerMode === 'manual') {
        return new Promise<ResourcePickerResponse>((resolve, reject) => {
          state.pendingResourcePicker = { requestId, options, resolve, reject }
          emit('resourcePicker.pending', { requestId, options })
        })
      }

      emit('resourcePicker.success', { requestId, value: state.resourcePickerResponse })
      return state.resourcePickerResponse
    },

    loading: {
      show() {
        state.loading = true
        emit('loading.show')
      },
      hide() {
        state.loading = false
        emit('loading.hide')
      },
    },

    saveBar: {
      show(id: string) {
        state.visibleSaveBars.add(id)
        emit('saveBar.show', { id })
      },
      hide(id: string) {
        state.visibleSaveBars.delete(id)
        emit('saveBar.hide', { id })
      },
    },

    navigation: {
      navigate(destination: unknown) {
        emit('navigation.navigate', destination)
      },
    },

    __debug: {
      getState: snapshot,
      emit,
      subscribe(listener: (event: ShopifyDebuggerEvent, state: ShopifyDebuggerState) => void) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      clearEvents() {
        state.events = []
        emit('debug.events.clear')
      },
      setResourcePickerMode(mode: ResourcePickerMode) {
        state.resourcePickerMode = mode
        emit('debug.resourcePickerMode.set', { mode })
      },
      setResourcePickerResponse(response: ResourcePickerResponse) {
        state.resourcePickerResponse = response
        emit('debug.resourcePickerResponse.set', response)
      },
      resolveResourcePicker: resolveManualResourcePicker,
      rejectResourcePicker: rejectManualResourcePicker,
    },
  }

  return bridge
}

export const shopifyDebugger = createShopifyDebuggerBridge()

export function installShopifyDebuggerGlobal(globalObject: Window = window) {
  ;(globalObject as unknown as { shopify: typeof shopifyDebugger }).shopify = shopifyDebugger
  return shopifyDebugger
}
