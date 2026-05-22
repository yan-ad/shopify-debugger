import { useEffect, useMemo, useState } from 'react'
import { shopifyDebugger, type ResourcePickerMode, type ShopifyDebuggerState } from './bridge'

export type ShopifyDebuggerPanelProps = {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean
}

const positionClassName = {
  'bottom-right': 'sd-panel--bottom-right',
  'bottom-left': 'sd-panel--bottom-left',
  'top-right': 'sd-panel--top-right',
  'top-left': 'sd-panel--top-left',
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp)
}

function stringify(value: unknown) {
  if (value === undefined) return ''

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ShopifyDebuggerPanel({
  position = 'bottom-right',
  defaultOpen = true,
}: ShopifyDebuggerPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [state, setState] = useState<ShopifyDebuggerState>(() => shopifyDebugger.__debug.getState())

  useEffect(() => {
    return shopifyDebugger.__debug.subscribe((_event, nextState) => {
      setState(nextState)
    })
  }, [])

  const pendingResourcePicker = state.pendingResourcePicker
  const pendingPayload = useMemo(() => stringify(pendingResourcePicker?.options), [pendingResourcePicker?.options])

  return (
    <div className={`sd-panel ${positionClassName[position]}`}>
      <button className="sd-panel__tab" type="button" onClick={() => setOpen((value) => !value)}>
        Shopify Debugger
        {state.events.length > 0 ? <span className="sd-panel__badge">{state.events.length}</span> : null}
      </button>

      {open ? (
        <div className="sd-panel__body">
          <header className="sd-panel__header">
            <div>
              <strong>Polaris App Bridge</strong>
              <small>local shim</small>
            </div>
            <button type="button" onClick={() => shopifyDebugger.__debug.clearEvents()}>
              Clear
            </button>
          </header>

          <section className="sd-panel__section">
            <label>
              Resource picker mode
              <select
                value={state.resourcePickerMode}
                onChange={(event) => {
                  shopifyDebugger.__debug.setResourcePickerMode(event.target.value as ResourcePickerMode)
                }}
              >
                <option value="success">success</option>
                <option value="cancel">cancel</option>
                <option value="error">error</option>
                <option value="manual">manual</option>
              </select>
            </label>

            {pendingResourcePicker ? (
              <div className="sd-panel__pending">
                <strong>Pending picker</strong>
                {pendingPayload ? <pre>{pendingPayload}</pre> : null}
                <div className="sd-panel__actions">
                  <button type="button" onClick={() => shopifyDebugger.__debug.resolveResourcePicker(state.resourcePickerResponse)}>
                    Resolve
                  </button>
                  <button type="button" onClick={() => shopifyDebugger.__debug.resolveResourcePicker(undefined)}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => shopifyDebugger.__debug.rejectResourcePicker()}>
                    Error
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {state.loading ? <div className="sd-panel__status">Loading active</div> : null}
          {state.lastToast ? <div className="sd-panel__toast">Toast: {state.lastToast.message}</div> : null}

          <section className="sd-panel__events">
            {state.events.length === 0 ? (
              <p className="sd-panel__empty">No bridge calls yet.</p>
            ) : (
              state.events.map((event) => (
                <article className="sd-event" key={event.id}>
                  <div className="sd-event__meta">
                    <strong>{event.type}</strong>
                    <span>{formatTime(event.timestamp)}</span>
                  </div>
                  {event.payload !== undefined ? <pre>{stringify(event.payload)}</pre> : null}
                </article>
              ))
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
