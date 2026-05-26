import React, { useEffect, useMemo, useRef, useState } from "react";
import "../style.css";

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
  activeModals?: Array<string | { id?: string; heading?: string }>;
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

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const shellModalRef = useRef<HTMLElement | null>(null);
  const shellModalTextRef = useRef<HTMLElement | null>(null);
  const suppressShellModalHideEventRef = useRef(false);

  const currentModal = useMemo(() => {
    const activeModals =
      Array.isArray(state.activeModals) ? state.activeModals : [];
    if (activeModals.length === 0) return { id: "", heading: "" };

    const firstModal = activeModals[0];
    if (typeof firstModal === "string") {
      return { id: firstModal, heading: "" };
    }

    return {
      id: firstModal?.id || "",
      heading: firstModal?.heading || "",
    };
  }, [state.activeModals]);

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
    const shellModal = shellModalRef.current;
    const shellModalText = shellModalTextRef.current;
    if (!shellModal || !shellModalText) return;

    const isOpen = Boolean(currentModal.id);

    if (!isOpen) {
      shellModalText.textContent = "No active modal.";
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

    const displayHeading = currentModal.heading || currentModal.id;
    shellModal.setAttribute("heading", displayHeading);
    shellModalText.textContent =
      displayHeading ?
        `App Bridge modal: ${displayHeading}`
      : "App Bridge modal is open in debugger shell.";

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
    <div
      style={{
        fontFamily: "Manrope, sans-serif",
        height: "100vh",
        background: "#f8fafc",
        color: "#111827",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header className="bg-zinc-900 flex justify-between items-center">
        <div>
          <strong>Shopify Debugger</strong>
          <div style={{ color: "#6b7280", marginTop: "2px", fontSize: "12px" }}>
            Zero-client-code local shell route
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nextUrl = appUrl || "/";
            setIframeUrl(nextUrl);
            setReady(false);
            push("frame.load", { url: nextUrl });
          }}
          style={{ display: "flex", gap: "8px" }}
        >
          <input
            aria-label="App URL"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            style={{
              padding: "9px 11px",
              border: "1px solid #d8dde3",
              borderRadius: "10px",
              width: "min(520px, 46vw)",
            }}
          />
          <s-button type="submit" variant="primary">
            Load
          </s-button>
          <s-button
            type="button"
            variant="secondary"
            onClick={() => {
              frameRef.current?.contentWindow?.location.reload();
              setReady(false);
              push("frame.refresh");
            }}
          >
            Refresh
          </s-button>
        </form>
      </header>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 390px",
          gap: "16px",
          padding: "16px",
          flex: 1,
          minHeight: 0,
        }}
      >
        <section
          style={{
            border: "1px solid #d8dde3",
            borderRadius: "14px",
            background: "#fff",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
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
        <aside
          style={{
            border: "1px solid #d8dde3",
            borderRadius: "14px",
            background: "#fff",
            padding: "14px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <h2>App Bridge Debugger</h2>
          <p style={{ color: "#6b7280", marginTop: "0", fontSize: "12px" }}>
            Stream events to this shell.
          </p>

          <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                width: "fit-content",
                borderRadius: "999px",
                padding: "4px 8px",
                fontSize: "12px",
                fontWeight: 650,
                background: ready ? "#dcfce7" : "#f1f5f9",
                color: ready ? "#166534" : "#6b7280",
              }}
            >
              {ready ? "iframe connected" : "waiting for iframe"}
            </span>
            <span
              style={{
                display: "inline-flex",
                width: "fit-content",
                borderRadius: "999px",
                padding: "4px 8px",
                fontSize: "12px",
                fontWeight: 650,
                background: state.pendingResourcePicker ? "#fef3c7" : "#f1f5f9",
                color: state.pendingResourcePicker ? "#92400e" : "#6b7280",
              }}
            >
              {state.pendingResourcePicker ?
                "resource picker pending"
              : "no pending picker"}
            </span>

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
      </main>

      <s-modal
        id="shell-modal"
        size="base"
        ref={shellModalRef as unknown as React.RefObject<any>}
      >
        <s-text
          id="shell-modal-text"
          ref={shellModalTextRef as unknown as React.RefObject<any>}
        >
          No active modal.
        </s-text>
        <s-button
          slot="secondary-actions"
          variant="secondary"
          disabled={!currentModal.id}
          onClick={() => {
            if (!currentModal.id) return;
            send("hideModal", currentModal.id);
          }}
        >
          Close modal
        </s-button>
      </s-modal>
    </div>
  );
}

export default DebuggerShell;
