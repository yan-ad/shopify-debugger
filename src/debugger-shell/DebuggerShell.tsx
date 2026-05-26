import React, { useState } from "react";

export function DebuggerShell() {
  const [appUrl, setAppUrl] = useState("/");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalHeading, setModalHeading] = useState("Debugger Modal");
  const [modalContent, setModalContent] = useState("");

  return (
    <div
      style={{
        fontFamily: "Manrope, sans-serif",
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 18px",
          borderBottom: "1px solid #d8dde3",
          background: "#fff",
        }}
      >
        <div>
          <strong>Shopify Debugger</strong>
          <small>Zero-client-code local shell route</small>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            console.log("Loading app URL:", appUrl);
          }}
          style={{ display: "flex", gap: "8px" }}
        >
          <input
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            style={{
              padding: "9px 11px",
              border: "1px solid #d8dde3",
              borderRadius: "10px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "9px 11px",
              background: "#1f2937",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
            }}
          >
            Load
          </button>
        </form>
      </header>

      <main
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 390px",
          gap: "16px",
          padding: "16px",
        }}
      >
        <section
          style={{
            border: "1px solid #d8dde3",
            borderRadius: "14px",
            background: "#fff",
          }}
        >
          <iframe
            src={appUrl}
            title="Debugged Shopify app"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </section>
        <aside
          style={{
            border: "1px solid #d8dde3",
            borderRadius: "14px",
            background: "#fff",
            padding: "14px",
          }}
        >
          <h2>App Bridge Debugger</h2>
          <p style={{ color: "#6b7280" }}>Stream events to this shell.</p>
        </aside>
      </main>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "10px",
              width: "400px",
            }}
          >
            <h2>{modalHeading}</h2>
            <p>
              {typeof modalContent === "object" ?
                <pre>{JSON.stringify(modalContent, null, 2)}</pre>
              : modalContent}
            </p>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                padding: "9px 11px",
                background: "#1f2937",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
