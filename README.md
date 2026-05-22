# Shopify Debugger

Local debugger and shim for Shopify Polaris App Bridge APIs.

This package lets a Shopify embedded app keep calling the normal App Bridge API during local development:

```ts
import { useAppBridge } from "@shopify/app-bridge-react";

const shopify = useAppBridge();

shopify.modal.show("delete-modal");
shopify.toast.show("Saved");
const products = await shopify.resourcePicker({ type: "product" });
```

When debugger mode is enabled, `@shopify/app-bridge-react` is aliased to this package's local shim. Your app code does not need to change.

## Install

```bash
bun add -d shopify-debugger
```

## Vite setup

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { shopifyDebugger } from "shopify-debugger/vite";

export default defineConfig({
  plugins: [react(), shopifyDebugger()],
});
```

Run local dev with debugger mode:

```bash
SHOPIFY_DEBUGGER=true bun run dev
```

`SHOPIFY_APP_BRIDGE_DEBUG=true` also works.

When enabled, the Vite plugin also registers a local debugger shell at:

```txt
http://localhost:5173/_debugger
```

Open that route to load your app inside a lightweight iframe host. This gives you a local Shopify-like debugging surface without going through `admin.shopify.com`.

You can customize the route or the iframe URL:

```ts
shopifyDebugger({
  debuggerRoute: "/_debugger",
  appUrl: "/?shop=debug-store.myshopify.com&embedded=1",
});
```

Set `debuggerRoute: false` to disable the route while keeping the App Bridge alias.

## Debug panel

You do not need to add a debug panel to the client app. The primary flow is zero client-code changes: open `/_debugger` and use the shell panel there.

The exported `<ShopifyDebuggerPanel />` still exists as an optional escape hatch for apps that cannot use the iframe shell route.

## Release

This package uses [changelogen](https://github.com/unjs/changelogen) for changelog and release automation.

Dry-run release notes:

```bash
bun run release:dry
```

Build, update changelog, tag, and push:

```bash
bun run release
```

Build, update changelog, tag, push, and publish to npm:

```bash
bun run release:publish
```

## Example

This repo includes a runnable example app:

```bash
cd example
bun install
bun run dev
```

Then open:

```txt
http://127.0.0.1:5173/_debugger
```

The example imports `useAppBridge` from `@shopify/app-bridge-react` normally. Only its Vite config uses `shopifyDebugger()`.

## What is supported?

Initial shim support:

- `useAppBridge()` from `@shopify/app-bridge-react`
- `shopify.modal.show(id)`
- `shopify.modal.hide(id)`
- `shopify.modal.toggle(id)`
- `shopify.toast.show(message, options?)`
- `shopify.resourcePicker(options)`
- `shopify.loading.show()` / `shopify.loading.hide()`
- `shopify.saveBar.show(id)` / `shopify.saveBar.hide(id)`
- `shopify.navigation.navigate(destination)`

The `/_debugger` shell shows a local event timeline and lets you switch resource picker behavior between:

- `success`
- `cancel`
- `error`
- `manual`

## Manual resource picker flow

When resource picker mode is `manual`, calls to `shopify.resourcePicker(...)` stay pending until you resolve, cancel, or reject them from the `/_debugger` shell.

## Modal fallback

When `shopify.modal.show('my-modal')` is called, the debugger tries to find `document.getElementById('my-modal')` and adds `open` plus `data-shopify-debugger-open="true"`.

A small CSS fallback is included for `ui-modal[data-shopify-debugger-open="true"]` so App Bridge modal content is visible locally.

## Programmatic control

```ts
import { shopifyDebugger } from "shopify-debugger";

shopifyDebugger.__debug.setResourcePickerMode("cancel");
shopifyDebugger.__debug.setResourcePickerResponse([
  {
    id: "gid://shopify/Product/123",
    title: "Custom debug product",
  },
]);
```

## Important caveat

This package mimics the public App Bridge API shape for local debugging. It does not emulate Shopify Admin, OAuth, billing, permissions, or the real Admin iframe host protocol.
