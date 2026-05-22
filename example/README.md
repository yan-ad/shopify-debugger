# Shopify Debugger Example

A minimal Vite + React app that demonstrates zero-client-code Shopify App Bridge debugging.

The example app imports from Shopify normally:

```js
import { useAppBridge } from '@shopify/app-bridge-react'
```

The only debugger integration is in `vite.config.js`:

```js
import { shopifyDebugger } from '@yan-ad/shopify-debugger/vite'

export default defineConfig({
  plugins: [
    react(),
    shopifyDebugger({
      appUrl: '/?shop=debug-store.myshopify.com&embedded=1',
    }),
  ],
})
```

## Run

From this folder:

```bash
bun install
bun run dev
```

Then open:

```txt
http://127.0.0.1:5173/_debugger
```

The debugger shell loads the app in an iframe and logs calls to:

- `shopify.modal.show/hide`
- `shopify.toast.show`
- `shopify.resourcePicker`
- `shopify.loading.show/hide`
- `shopify.saveBar.show/hide`
