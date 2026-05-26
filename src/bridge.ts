export type ShopifyDebuggerEvent = {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
};

export type ResourcePickerMode = "success" | "cancel" | "error" | "manual";

export type ResourcePickerResponse = unknown[] | undefined;

export type ToastOptions = {
  isError?: boolean;
  tone?: "neutral" | "critical";
};

export type ModalAction = {
  actionIndex: number;
  label: string;
  variant?: "primary" | "secondary";
};

export type ModalDescriptor = {
  id: string;
  heading?: string;
  content?: unknown;
  body?: unknown;
  actions?: ModalAction[];
};

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
  activeModals: Set<string | ModalDescriptor>;
  loading: boolean;
  visibleSaveBars: Set<string>;
  lastToast?: {
    message: string;
    options?: ToastOptions;
  };
};

type ParentCommand = {
  source?: string;
  command?: string;
  payload?: unknown;
};

type TriggerModalActionPayload = {
  id?: unknown;
  actionIndex?: unknown;
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

function findModalElement(id: string) {
  if (typeof document === "undefined") return undefined;

  const element = document.getElementById(id);
  if (!element) return undefined;

  return element as HTMLElement;
}

function collectModalActions(modalElement: HTMLElement) {
  const actions: ModalAction[] = [];
  const buttonElements = modalElement.querySelectorAll(
    "[slot='titleBar'] button, [slot='titleBar'] s-button, [data-shopify-debugger-title-bar='true'] button, [data-shopify-debugger-title-bar='true'] s-button",
  );

  buttonElements.forEach((element, actionIndex) => {
    const label = element.textContent?.trim() || `Action ${actionIndex + 1}`;
    const variant =
      element.getAttribute("variant") === "primary" ? "primary" : "secondary";
    actions.push({ actionIndex, label, variant });
  });

  return actions;
}

function extractModalDescriptor(
  arg: string | ModalDescriptor,
): ModalDescriptor {
  const base =
    typeof arg === "string" ? ({ id: arg } satisfies ModalDescriptor) : arg;
  const modalElement = findModalElement(base.id);
  if (!modalElement) {
    return {
      ...base,
      content: base.content ?? base.body,
    };
  }

  const titleBar =
    modalElement.querySelector("[slot='titleBar']") ||
    modalElement.querySelector("[data-shopify-debugger-title-bar='true']");

  const heading =
    base.heading ||
    modalElement.getAttribute("heading") ||
    titleBar?.querySelector("strong")?.textContent?.trim() ||
    base.id;

  const contentFromPayload = base.content ?? base.body;
  const content =
    contentFromPayload ??
    (() => {
      const bodyHost = modalElement.cloneNode(true) as HTMLElement;
      bodyHost
        .querySelectorAll(
          "[slot='titleBar'], [data-shopify-debugger-title-bar='true']",
        )
        .forEach((element) => element.remove());

      return bodyHost.textContent?.trim() || undefined;
    })();

  return {
    ...base,
    heading,
    content,
    actions: collectModalActions(modalElement),
  };
}

function triggerModalAction(payload: TriggerModalActionPayload) {
  const id = typeof payload.id === "string" ? payload.id : "";
  const actionIndex =
    typeof payload.actionIndex === "number" ? payload.actionIndex : -1;
  if (!id || actionIndex < 0) return false;

  const modalElement = findModalElement(id);
  if (!modalElement) return false;

  const buttonElements = modalElement.querySelectorAll(
    "[slot='titleBar'] button, [slot='titleBar'] s-button, [data-shopify-debugger-title-bar='true'] button, [data-shopify-debugger-title-bar='true'] s-button",
  );

  const actionElement = buttonElements.item(actionIndex) as
    | HTMLElement
    | undefined;

  if (!actionElement) return false;
  actionElement.click();
  return true;
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
        } else if (
          typeof command.payload === "object" &&
          command.payload &&
          typeof (command.payload as { id?: unknown }).id === "string"
        ) {
          bridge.modal.show(command.payload as ModalDescriptor);
        }
        return;
      case "hideModal":
        if (typeof command.payload === "string" && command.payload) {
          bridge.modal.hide(command.payload);
        } else if (
          typeof command.payload === "object" &&
          command.payload &&
          typeof (command.payload as { id?: unknown }).id === "string"
        ) {
          bridge.modal.hide(command.payload as { id: string });
        }
        return;
      case "triggerModalAction": {
        const payload = (command.payload || {}) as TriggerModalActionPayload;
        const ok = triggerModalAction(payload);
        emit("modal.action.trigger", {
          id: payload.id,
          actionIndex: payload.actionIndex,
          ok,
        });
        return;
      }
      default:
        emit("debug.unknownParentCommand", command);
    }
  }

  const bridge = {
    modal: {
      show(arg: string | ModalDescriptor) {
        const modalObj = extractModalDescriptor(arg);
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
        const toRemove: Array<string | ModalDescriptor> = [];
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
      toggle(arg: string | ModalDescriptor) {
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
      show(message: string, options?: ToastOptions) {
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
      start() {
        state.loading = true;
        emit("loading.start");
      },
      stop() {
        state.loading = false;
        emit("loading.stop");
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
