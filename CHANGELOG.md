# Changelog

All notable changes to this project will be documented in this file.

This project uses [changelogen](https://github.com/unjs/changelogen) for release notes.

## v0.1.1


### 🚀 Enhancements

- First alpha test ([786983e](https://github.com/yan-ad/shopify-debugger/commit/786983e))

### ❤️ Contributors

- Yan-ad ([@ngalor](https://github.com/ngalor))

## v0.1.0

Initial release.

### Features

- Add local Shopify App Bridge debugger shim for `@shopify/app-bridge-react`.
- Add Vite plugin that aliases App Bridge imports when debugger mode is enabled.
- Add `/_debugger` Vite route as the primary zero-client-code debugger UI.
- Add resource picker success, cancel, error, and manual modes.
- Add local modal, toast, loading, save bar, and navigation event support.
- Add runnable Vite React example app in `/example`.
