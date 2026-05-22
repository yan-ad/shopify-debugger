import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useAppBridge } from '@shopify/app-bridge-react'
import './style.css'

function App() {
  const shopify = useAppBridge()
  const [selectedResources, setSelectedResources] = useState([])
  const [lastError, setLastError] = useState('')

  async function pickProduct() {
    setLastError('')

    try {
      const resources = await shopify.resourcePicker({
        type: 'product',
        multiple: true,
      })

      setSelectedResources(resources ?? [])
      shopify.toast.show(resources ? `Picked ${resources.length} resource(s)` : 'Picker cancelled')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLastError(message)
      shopify.toast.show(`Picker error: ${message}`)
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">@yan-ad/shopify-debugger</p>
        <h1>Shopify App Bridge debugger example</h1>
        <p>
          This app imports <code>useAppBridge</code> from <code>@shopify/app-bridge-react</code> normally.
          Run it with <code>SHOPIFY_DEBUGGER=true</code>, open <code>/_debugger</code>, and the Vite plugin will
          alias App Bridge to the local debugger shim.
        </p>
      </section>

      <section className="card">
        <h2>Actions</h2>
        <div className="actions">
          <button type="button" onClick={() => shopify.modal.show('example-modal')}>
            Show modal
          </button>
          <button type="button" onClick={() => shopify.toast.show('Hello from App Bridge toast')}>
            Show toast
          </button>
          <button type="button" onClick={pickProduct}>
            Pick product
          </button>
          <button type="button" onClick={() => shopify.loading.show()}>
            Loading show
          </button>
          <button type="button" onClick={() => shopify.loading.hide()}>
            Loading hide
          </button>
          <button type="button" onClick={() => shopify.saveBar.show('example-save-bar')}>
            Save bar show
          </button>
          <button type="button" onClick={() => shopify.saveBar.hide('example-save-bar')}>
            Save bar hide
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Selected resources</h2>
        {lastError ? <p className="error">{lastError}</p> : null}
        {selectedResources.length === 0 ? (
          <p className="muted">No resources selected yet.</p>
        ) : (
          <pre>{JSON.stringify(selectedResources, null, 2)}</pre>
        )}
      </section>

      <ui-modal id="example-modal">
        <div className="modal-content">
          <h2>Example modal</h2>
          <p>
            This is a <code>ui-modal</code> element. The debugger shim toggles its <code>open</code> attribute locally.
          </p>
          <button type="button" onClick={() => shopify.modal.hide('example-modal')}>
            Close modal
          </button>
        </div>
      </ui-modal>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
