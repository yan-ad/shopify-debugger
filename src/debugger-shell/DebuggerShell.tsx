import React, { useEffect, useMemo, useRef, useState } from "react";
import "../style.css";
import type { ToastOptions } from "../bridge";

declare global {
  interface Window {
    __SHOPIFY_DEBUGGER_INITIAL_APP_URL?: string;
  }
}

function getInitialAppUrl() {
  if (typeof window === "undefined") return "/";
  return window.__SHOPIFY_DEBUGGER_INITIAL_APP_URL || "/";
}

type DebuggerEvent = {
  type: string;
  payload?: unknown;
  time: string;
};

type ShellState = {
  resourcePickerMode?: string;
  pendingResourcePicker?: unknown;
  activeModals?: Array<
    | string
    | {
        id?: string;
        heading?: string;
        content?: unknown;
        body?: unknown;
        actions?: Array<{
          actionIndex?: number;
          label?: string;
          variant?: "primary" | "secondary";
        }>;
      }
  >;
};

type ShellToast = {
  id: number;
  message: string;
  tone: "neutral" | "critical";
};

export function DebuggerShell() {
  const [appUrl, setAppUrl] = useState(getInitialAppUrl);
  const [iframeUrl, setIframeUrl] = useState(getInitialAppUrl);
  const [ready, setReady] = useState(false);
  const [resourceMode, setResourceMode] = useState("success");
  const [resourceResponse, setResourceResponse] = useState(
    JSON.stringify(
      [
        {
          id: "gid://shopify/Product/1",
          title: "Debug Product",
          handle: "debug-product",
          variants: [
            {
              id: "gid://shopify/ProductVariant/1",
              title: "Default Title",
              price: "10.00",
              sku: "DEBUG-1",
            },
          ],
        },
      ],
      null,
      2,
    ),
  );
  const [events, setEvents] = useState<DebuggerEvent[]>([]);
  const [state, setState] = useState<ShellState>({});
  const [toasts, setToasts] = useState<ShellToast[]>([]);

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const shellModalRef = useRef<HTMLElement | null>(null);
  const suppressShellModalHideEventRef = useRef(false);
  const toastSequenceRef = useRef(0);
  const toastTimeoutsRef = useRef(new Map<number, number>());

  const currentModal = useMemo(() => {
    const activeModals =
      Array.isArray(state.activeModals) ? state.activeModals : [];
    if (activeModals.length === 0) {
      return {
        id: "",
        heading: "",
        content: undefined as unknown,
        actions: [],
      };
    }

    const firstModal = activeModals[0];
    if (typeof firstModal === "string") {
      return {
        id: firstModal,
        heading: "",
        content: undefined as unknown,
        actions: [],
      };
    }

    return {
      id: firstModal?.id || "",
      heading: firstModal?.heading || "",
      content: firstModal?.content ?? firstModal?.body,
      actions: Array.isArray(firstModal?.actions) ? firstModal.actions : [],
    };
  }, [state.activeModals]);

  const currentModalContentText = useMemo(() => {
    if (currentModal.content === undefined) return "";
    if (typeof currentModal.content === "string") return currentModal.content;

    try {
      return JSON.stringify(currentModal.content, null, 2);
    } catch {
      return String(currentModal.content);
    }
  }, [currentModal.content]);

  function push(type: string, payload?: unknown) {
    setEvents((previousEvents) =>
      [
        {
          type,
          payload,
          time: new Date().toLocaleTimeString(),
        },
        ...previousEvents,
      ].slice(0, 100),
    );
  }

  function send(command: string, payload?: unknown) {
    frameRef.current?.contentWindow?.postMessage(
      { source: "shopify-debugger-shell", command, payload },
      "*",
    );
  }

  function parseResourceResponse() {
    return JSON.parse(resourceResponse);
  }

  function dismissToast(id: number) {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }

    setToasts((previousToasts) =>
      previousToasts.filter((toast) => toast.id !== id),
    );
  }

  function showToast(message: string, tone: ShellToast["tone"] = "neutral") {
    toastSequenceRef.current += 1;
    const id = toastSequenceRef.current;

    setToasts((previousToasts) =>
      [...previousToasts, { id, message, tone }].slice(-4),
    );

    const timeoutId = window.setTimeout(() => {
      dismissToast(id);
    }, 3500);

    toastTimeoutsRef.current.set(id, timeoutId);
  }

  function syncState(nextState: ShellState | undefined) {
    if (!nextState) return;

    setState(nextState);
    setReady(true);
    setResourceMode(nextState.resourcePickerMode || "success");
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.source !== "shopify-debugger-client") return;

      if (message.type === "ready") {
        syncState(message.payload as ShellState);
        push("client.ready", message.payload);
        return;
      }

      if (message.type === "state") {
        syncState(message.payload as ShellState);
        return;
      }

      if (message.type === "event") {
        const nextPayload = message.payload as {
          state?: ShellState;
          event?: { type?: string; payload?: unknown };
        };
        syncState(nextPayload?.state);
        if (nextPayload?.event?.type === "toast.show") {
          const payload = nextPayload.event.payload as
            | {
                message?: unknown;
                options?: ToastOptions;
              }
            | undefined;

          if (typeof payload?.message === "string" && payload.message) {
            const isCritical =
              payload?.options?.isError === true ||
              payload?.options?.tone === "critical";
            showToast(payload.message, isCritical ? "critical" : "neutral");
          }
        }
        push(
          nextPayload?.event?.type || "appBridge.event",
          nextPayload?.event?.payload,
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const shellModal = shellModalRef.current;
    if (!shellModal) return;

    const isOpen = Boolean(currentModal.id);

    if (!isOpen) {
      shellModal.removeAttribute("heading");
      if (typeof (shellModal as any).hideOverlay === "function") {
        suppressShellModalHideEventRef.current = true;
        (shellModal as any).hideOverlay();
        queueMicrotask(() => {
          suppressShellModalHideEventRef.current = false;
        });
      }
      return;
    }

    const displayHeading = currentModal.heading || currentModal.id || "Modal";
    shellModal.setAttribute("heading", displayHeading);

    if (typeof (shellModal as any).showOverlay === "function") {
      (shellModal as any).showOverlay();
    }
  }, [currentModal.heading, currentModal.id]);

  useEffect(() => {
    const shellModal = shellModalRef.current;
    if (!shellModal) return;

    const onHide = () => {
      if (suppressShellModalHideEventRef.current) return;
      if (!currentModal.id) return;
      send("hideModal", currentModal.id);
    };

    shellModal.addEventListener("hide", onHide as EventListener);
    return () => {
      shellModal.removeEventListener("hide", onHide as EventListener);
    };
  }, [currentModal.id]);

  return (
    <div className="bg-zinc-900 h-screen flex flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const nextUrl = appUrl || "/";
          setIframeUrl(nextUrl);
          setReady(false);
          push("frame.load", { url: nextUrl });
        }}
        className="flex justify-between h-14 items-center gap-1 text-white px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <strong>Shopify Debugger</strong>
          <s-badge tone={ready ? "success" : "neutral"}>
            {ready ? "Connected" : "Pending"}
          </s-badge>
        </div>
        <input
          aria-label="App URL"
          value={appUrl}
          onChange={(e) => setAppUrl(e.currentTarget.value)}
          className="grow rounded-xl lg:max-w-160 border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
        />
        <div>
          <s-button type="submit" variant="primary">
            Load
          </s-button>
          <s-button
            type="button"
            variant="secondary"
            onClick={() => {
              const baseUrl = iframeUrl || appUrl || "/";
              let nextUrl = baseUrl;

              try {
                const parsed = new URL(baseUrl, window.location.href);
                parsed.searchParams.set("__sd_refresh", String(Date.now()));
                nextUrl = parsed.toString();
              } catch {
                nextUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}__sd_refresh=${Date.now()}`;
              }

              setIframeUrl(nextUrl);
              setReady(false);
              push("frame.refresh", { url: nextUrl });
            }}
          >
            Refresh
          </s-button>
        </div>
      </form>

      <main className="grid grow lg:grid-cols-12 rounded-xl overflow-hidden bg-white">
        <aside className="hidden lg:block lg:col-span-2 p-4 bg-neutral-200/50 h-full overflow-auto">
          <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
            <label style={{ fontSize: "12px", fontWeight: 650 }}>
              Resource picker mode
            </label>
            <select
              value={resourceMode}
              onChange={(e) => {
                const nextMode = e.target.value;
                setResourceMode(nextMode);
                send("setResourcePickerMode", nextMode);
              }}
            >
              <option value="success">success</option>
              <option value="cancel">cancel</option>
              <option value="error">error</option>
              <option value="manual">manual</option>
            </select>

            <label style={{ fontSize: "12px", fontWeight: 650 }}>
              Resource picker success response JSON
            </label>
            <textarea
              value={resourceResponse}
              onChange={(e) => setResourceResponse(e.target.value)}
              style={{
                minHeight: "112px",
                resize: "vertical",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "12px",
              }}
            />

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  try {
                    send("setResourcePickerResponse", parseResourceResponse());
                  } catch (error) {
                    alert(
                      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
                    );
                  }
                }}
              >
                Save response
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    send("resolveResourcePicker", parseResourceResponse());
                  } catch (error) {
                    alert(
                      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
                    );
                  }
                }}
              >
                Resolve pending
              </button>
              <button
                type="button"
                onClick={() => send("resolveResourcePicker")}
              >
                Cancel pending
              </button>
              <button
                type="button"
                onClick={() => send("rejectResourcePicker")}
              >
                Error pending
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvents([]);
                  send("clearEvents");
                }}
              >
                Clear events
              </button>
            </div>
          </div>

          <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {events.length === 0 ?
              <p style={{ color: "#6b7280", fontSize: "13px" }}>
                No App Bridge calls yet.
              </p>
            : events.map((event, index) => (
                <article
                  key={`${event.type}-${event.time}-${index}`}
                  style={{
                    border: "1px solid #d8dde3",
                    borderRadius: "10px",
                    padding: "10px",
                    background: "#f7f8fa",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "10px",
                      fontSize: "12px",
                    }}
                  >
                    <strong>{event.type}</strong>
                    <span style={{ color: "#6b7280" }}>{event.time}</span>
                  </div>
                  {event.payload === undefined ? null : (
                    <pre
                      style={{
                        overflow: "auto",
                        maxHeight: "180px",
                        margin: "8px 0 0",
                        borderRadius: "8px",
                        background: "#111827",
                        color: "#e5e7eb",
                        padding: "8px",
                        fontSize: "11px",
                        lineHeight: 1.45,
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </article>
              ))
            }
          </div>
        </aside>
        <section className="lg:col-span-10" style={{ minHeight: 0 }}>
          <iframe
            ref={frameRef}
            src={iframeUrl}
            title="Debugged Shopify app"
            onLoad={() => send("getState")}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              minHeight: "100%",
            }}
          />
        </section>
      </main>

      <s-modal
        id="shell-modal"
        size="base"
        ref={shellModalRef as unknown as React.RefObject<any>}
      >
        {currentModalContentText ?
          currentModalContentText
        : <p className="text-sm text-zinc-500">No modal body content.</p>}

        {currentModal.actions.length > 0 ?
          <div className="mt-3 flex flex-wrap gap-2">
            {currentModal.actions.map((action, index) => {
              const actionIndex =
                typeof action.actionIndex === "number" ?
                  action.actionIndex
                : index;
              const label = action.label || `Action ${index + 1}`;
              const variant =
                action.variant === "primary" ? "primary" : "secondary";

              return (
                <s-button
                  key={`${currentModal.id}-${actionIndex}-${label}`}
                  variant={variant}
                  onClick={() => {
                    send("triggerModalAction", {
                      id: currentModal.id,
                      actionIndex,
                    });
                  }}
                >
                  {label}
                </s-button>
              );
            })}
          </div>
        : null}
      </s-modal>

      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.tone === "critical" ?
                "pointer-events-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 shadow"
              : "pointer-events-auto rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow"
            }
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="m-0 leading-5">{toast.message}</p>
              <button
                type="button"
                className="rounded px-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss toast"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DebuggerShell;
