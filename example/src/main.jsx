import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAppBridge } from "@shopify/app-bridge-react";
import "./style.css";

function App() {
  const shopify = useAppBridge();
  const [selectedResources, setSelectedResources] = useState([]);
  const [lastError, setLastError] = useState("");

  async function pickProduct() {
    setLastError("");

    try {
      const resources = await shopify.resourcePicker({
        type: "product",
        multiple: true,
      });

      setSelectedResources(resources ?? []);
      shopify.toast.show(
        resources ?
          `Picked ${resources.length} resource(s)`
        : "Picker cancelled",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastError(message);
      shopify.toast.show(`Picker error: ${message}`);
    }
  }

  return (
    <>
      <main className="page">
        <s-section heading="Shopify App Bridge Debugger Example">
          <s-paragraph>
            This app imports <code>useAppBridge</code> from{" "}
            <code>@shopify/app-bridge-react</code> normally. Run it with{" "}
            <code>SHOPIFY_DEBUGGER=true</code>, open <code>/_debugger</code>,
            and the Vite plugin will alias App Bridge to the local debugger
            shim.
          </s-paragraph>
        </s-section>

        <s-section heading="Actions">
          <s-stack gap="small" direction="inline">
            <s-button
              type="button"
              onClick={() => {
                shopify.modal.show({
                  id: "example-modal",
                  heading: "Example modal",
                });
              }}
            >
              Show Modal
            </s-button>
            <s-button
              type="button"
              onClick={() => {
                shopify.toast.show("This is a simulated toast message.");
              }}
            >
              Show Toast
            </s-button>
            <s-button
              type="button"
              onClick={() => {
                shopify.toast.show("This is a simulated toast message.");
              }}
            >
              Simulate Toast
            </s-button>
            <s-button
              type="button"
              onClick={() => {
                shopify.loading.start();
                setTimeout(() => shopify.loading.stop(), 2000);
              }}
            >
              Simulate Loading
            </s-button>
            <s-button type="button" onClick={pickProduct}>
              Pick product
            </s-button>
            <s-button
              button
              type="button"
              onClick={() => shopify.loading.show()}
            >
              Loading show
            </s-button>
            <s-button type="button" onClick={() => shopify.loading.hide()}>
              Loading hide
            </s-button>
            <s-button
              type="button"
              onClick={() => shopify.saveBar.show("example-save-bar")}
            >
              Save bar show
            </s-button>
            <s-button
              type="button"
              onClick={() => shopify.saveBar.hide("example-save-bar")}
            >
              Save bar hide
            </s-button>
            <s-button
              type="button"
              onClick={async () => {
                try {
                  const response = await fetch("/api/perform-action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "example" }),
                  });

                  if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
                  }

                  const result = await response.json();
                  shopify.modal.show({
                    id: "example-modal",
                    heading: "Action Result",
                    content: JSON.stringify(result, null, 2),
                  });
                } catch (error) {
                  shopify.toast.show(
                    `Action failed: ${error instanceof Error ? error.message : error}`,
                  );
                }
              }}
            >
              Perform Action
            </s-button>
            <s-button
              type="button"
              onClick={async () => {
                try {
                  const response = await fetch("/api/perform-action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "debugger-action" }),
                  });

                  if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
                  }

                  const result = await response.json();
                  shopify.toast.show(`Action performed: ${result.message}`);
                } catch (error) {
                  shopify.toast.show(
                    `Action failed: ${error instanceof Error ? error.message : error}`,
                  );
                }
              }}
            >
              Perform Action Debugger
            </s-button>
          </s-stack>
        </s-section>

        <s-section className="card" heading="Selected resources">
          {lastError ?
            <p className="error">{lastError}</p>
          : null}
          {selectedResources.length === 0 ?
            <p className="muted">No resources selected yet.</p>
          : <pre>{JSON.stringify(selectedResources, null, 2)}</pre>}
        </s-section>

        <ui-modal id="example-modal">
          <div className="modal-content">
            <h2>Example modal</h2>
            <p>
              This is a <code>ui-modal</code> element. The debugger shim toggles
              its <code>open</code> attribute locally.
            </p>
            <button
              type="button"
              onClick={() => shopify.modal.hide("example-modal")}
            >
              Close modal
            </button>
          </div>
        </ui-modal>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
