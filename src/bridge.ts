export type ShopifyDebuggerEvent = {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
};

export type ResourcePickerMode = "success" | "cancel" | "error" | "manual";

export type ResourcePickerResponse = unknown[] | undefined;

export type ShopifyDebuggerState = {
  events: ShopifyDebuggerEvent[];
  resourcePickerMode: ResourcePickerMode;
  resourcePickerResponse: ResourcePickerResponse;
  pendingResourcePicker?: {
    requestId: string;
    options: unknown;
    resolve: (value: ResourcePickerResponse) => void;
    reject: (error: Error) => void;
  };
  // Now supports Set<string | {id: string, heading?: string}>
  activeModals: Set<string | { id: string; heading?: string }>;
  loading: boolean;
  visibleSaveBars: Set<string>;
  lastToast?: {
    message: string;
    options?: unknown;
  };
};

type ParentCommand = {
  source?: string;
  command?: string;
  payload?: unknown;
};

export type ShopifyDebuggerBridge = ReturnType<
  typeof createShopifyDebuggerBridge
>;

let eventSequence = 0;

function createEvent(type: string, payload?: unknown): ShopifyDebuggerEvent {
  eventSequence += 1;

  return {
    id: `shopify-debugger-event-${eventSequence}`,
    type,
    payload,
    timestamp: Date.now(),
  };
}

const defaultProduct = {
  id: "gid://shopify/Product/1",
  title: "Debug Product",
  handle: "debug-product",
  onlineStoreUrl: "https://debug-store.myshopify.com/products/debug-product",
  featuredImage: {
    id: "gid://shopify/ProductImage/1",
    altText: "Debug product image",
    url: "https://cdn.shopify.com/s/files/1/0000/0001/products/debug-product.png",
  },
  variants: [
    {
      id: "gid://shopify/ProductVariant/1",
      title: "Default Title",
      price: "10.00",
      sku: "DEBUG-1",
    },
  ],
};

function serializeState(state: ShopifyDebuggerState) {
  return {
    ...state,
    events: [...state.events],
    activeModals: [...state.activeModals],
    visibleSaveBars: [...state.visibleSaveBars],
    pendingResourcePicker:
      state.pendingResourcePicker ?
        {
          requestId: state.pendingResourcePicker.requestId,
          options: state.pendingResourcePicker.options,
        }
      : undefined,
  };
}

function postToParent(type: string, payload?: unknown) {
  if (typeof window === "undefined" || window.parent === window) return;

  window.parent.postMessage(
    {
      source: "shopify-debugger-client",
      type,
      payload,
    },
    "*",
  );
}

export function createShopifyDebuggerBridge() {
  const listeners = new Set<
    (event: ShopifyDebuggerEvent, state: ShopifyDebuggerState) => void
  >();

  const state: ShopifyDebuggerState = {
    events: [],
    resourcePickerMode: "success",
    resourcePickerResponse: [defaultProduct],
    activeModals: new Set(),
    loading: false,
    visibleSaveBars: new Set(),
  };

  function snapshot(): ShopifyDebuggerState {
    return {
      ...state,
      events: [...state.events],
      activeModals: new Set(state.activeModals),
      visibleSaveBars: new Set(state.visibleSaveBars),
    };
  }

  function notify(event: ShopifyDebuggerEvent) {
    const nextSnapshot = snapshot();

    for (const listener of listeners) {
      listener(event, nextSnapshot);
    }

    postToParent("event", {
      event,
      state: serializeState(nextSnapshot),
    });
  }

  function emit(type: string, payload?: unknown) {
    const event = createEvent(type, payload);
    state.events = [event, ...state.events].slice(0, 200);
    console.debug("[Shopify Debugger]", type, payload);
    notify(event);
    return event;
  }

  function resolveManualResourcePicker(value: ResourcePickerResponse) {
    if (!state.pendingResourcePicker) return false;

    const pending = state.pendingResourcePicker;
    state.pendingResourcePicker = undefined;
    emit("resourcePicker.resolve", { requestId: pending.requestId, value });
    pending.resolve(value);
    return true;
  }

  function rejectManualResourcePicker(
    message = "Debug resource picker rejected",
  ) {
    if (!state.pendingResourcePicker) return false;

    const pending = state.pendingResourcePicker;
    state.pendingResourcePicker = undefined;
    const error = new Error(message);
    emit("resourcePicker.reject", { requestId: pending.requestId, message });
    pending.reject(error);
    return true;
  }

  function handleParentCommand(command: ParentCommand) {
    if (command.source !== "shopify-debugger-shell") return;

    switch (command.command) {
      case "getState":
        postToParent("state", serializeState(snapshot()));
        return;
      case "clearEvents":
        bridge.__debug.clearEvents();
        return;
      case "setResourcePickerMode":
        bridge.__debug.setResourcePickerMode(
          command.payload as ResourcePickerMode,
        );
        return;
      case "setResourcePickerResponse":
        bridge.__debug.setResourcePickerResponse(
          command.payload as ResourcePickerResponse,
        );
        return;
      case "resolveResourcePicker":
        bridge.__debug.resolveResourcePicker(
          command.payload as ResourcePickerResponse,
        );
        return;
      case "rejectResourcePicker":
        bridge.__debug.rejectResourcePicker();
        return;
      case "showModal":
        if (typeof command.payload === "string" && command.payload) {
          bridge.modal.show(command.payload);
        }
        return;
      case "hideModal":
        if (typeof command.payload === "string" && command.payload) {
          bridge.modal.hide(command.payload);
        }
        return;
      default:
        emit("debug.unknownParentCommand", command);
    }
  }

  const bridge = {
    modal: {
      show(arg: string | { id: string; heading?: string }) {
        let modalObj: { id: string; heading?: string };
        if (typeof arg === "string") {
          modalObj = { id: arg };
        } else {
          modalObj = arg;
        }
        // Remove any existing modal with same id (as string or object)
        state.activeModals.forEach((m) => {
          if (
            (typeof m === "string" && m === modalObj.id) ||
            (typeof m === "object" && m.id === modalObj.id)
          ) {
            state.activeModals.delete(m);
          }
        });
        state.activeModals.add(modalObj);
        emit("modal.show", modalObj);
      },
      hide(arg: string | { id: string }) {
        let id = typeof arg === "string" ? arg : arg.id;
        // Collect all modals to remove (avoid mutating during iteration)
        const toRemove = [];
        state.activeModals.forEach((m) => {
          if (
            (typeof m === "string" && m === id) ||
            (typeof m === "object" && m.id === id)
          ) {
            toRemove.push(m);
          }
        });
        toRemove.forEach((m) => state.activeModals.delete(m));
        emit("modal.hide", { id });
      },
      toggle(arg: string | { id: string; heading?: string }) {
        let id = typeof arg === "string" ? arg : arg.id;
        let exists = false;
        state.activeModals.forEach((m) => {
          if (
            (typeof m === "string" && m === id) ||
            (typeof m === "object" && m.id === id)
          ) {
            exists = true;
          }
        });
        if (exists) {
          bridge.modal.hide(id);
        } else {
          bridge.modal.show(arg);
        }
      },
    },

    toast: {
      show(message: string, options?: unknown) {
        state.lastToast = { message, options };
        emit("toast.show", { message, options });
      },
    },

    async resourcePicker(options: unknown): Promise<ResourcePickerResponse> {
      const requestId = `resource-picker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      emit("resourcePicker.open", {
        requestId,
        options,
        mode: state.resourcePickerMode,
      });

      if (state.resourcePickerMode === "cancel") {
        emit("resourcePicker.cancel", { requestId });
        return undefined;
      }

      if (state.resourcePickerMode === "error") {
        emit("resourcePicker.error", { requestId });
        throw new Error("Debug resource picker error");
      }

      if (state.resourcePickerMode === "manual") {
        return new Promise<ResourcePickerResponse>((resolve, reject) => {
          state.pendingResourcePicker = { requestId, options, resolve, reject };
          emit("resourcePicker.pending", { requestId, options });
        });
      }

      emit("resourcePicker.success", {
        requestId,
        value: state.resourcePickerResponse,
      });
      return state.resourcePickerResponse;
    },

    loading: {
      show() {
        state.loading = true;
        emit("loading.show");
      },
      hide() {
        state.loading = false;
        emit("loading.hide");
      },
    },

    saveBar: {
      show(id: string) {
        state.visibleSaveBars.add(id);
        emit("saveBar.show", { id });
      },
      hide(id: string) {
        state.visibleSaveBars.delete(id);
        emit("saveBar.hide", { id });
      },
    },

    navigation: {
      navigate(destination: unknown) {
        emit("navigation.navigate", destination);
      },
    },

    __debug: {
      getState: snapshot,
      emit,
      subscribe(
        listener: (
          event: ShopifyDebuggerEvent,
          state: ShopifyDebuggerState,
        ) => void,
      ) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      clearEvents() {
        state.events = [];
        emit("debug.events.clear");
      },
      setResourcePickerMode(mode: ResourcePickerMode) {
        state.resourcePickerMode = mode;
        emit("debug.resourcePickerMode.set", { mode });
      },
      setResourcePickerResponse(response: ResourcePickerResponse) {
        state.resourcePickerResponse = response;
        emit("debug.resourcePickerResponse.set", response);
      },
      resolveResourcePicker: resolveManualResourcePicker,
      rejectResourcePicker: rejectManualResourcePicker,
    },
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) =>
      handleParentCommand(event.data as ParentCommand),
    );
    queueMicrotask(() => postToParent("ready", serializeState(snapshot())));
  }

  return bridge;
}

export const shopifyDebugger = createShopifyDebuggerBridge();

export function installShopifyDebuggerGlobal(globalObject: Window = window) {
  (globalObject as unknown as { shopify: typeof shopifyDebugger }).shopify =
    shopifyDebugger;
  return shopifyDebugger;
}
