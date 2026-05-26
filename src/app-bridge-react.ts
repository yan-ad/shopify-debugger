import React from "react";
import { shopifyDebugger } from "./bridge";

export function useAppBridge() {
  return shopifyDebugger;
}

export const Provider = ({ children }: { children?: unknown }) => children;
export const AppBridgeProvider = Provider;

type ModalProps = React.PropsWithChildren<
  {
    id: string;
    open?: boolean;
  } & React.HTMLAttributes<HTMLElement>
>;

type TitleBarProps = React.PropsWithChildren<{
  title?: string;
}>;

export function Modal({ id, open, children, ...rest }: ModalProps) {
  return React.createElement(
    "ui-modal",
    {
      id,
      ...(open ? { open: true } : {}),
      ...rest,
    },
    children,
  );
}

export function TitleBar({ title, children }: TitleBarProps) {
  return React.createElement(
    "div",
    {
      slot: "titleBar",
      "data-shopify-debugger-title-bar": "true",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      },
    },
    title ? React.createElement("strong", null, title) : null,
    children,
  );
}

export { shopifyDebugger };
export type {
  ResourcePickerMode,
  ResourcePickerResponse,
  ShopifyDebuggerBridge,
  ShopifyDebuggerEvent,
  ShopifyDebuggerState,
  ToastOptions,
} from "./bridge";
