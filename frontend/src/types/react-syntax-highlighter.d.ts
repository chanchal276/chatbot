declare module "react-syntax-highlighter" {
  import * as React from "react";

  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, React.CSSProperties>;
    customStyle?: React.CSSProperties;
    children?: React.ReactNode;
    [key: string]: unknown;
  }

  export const Prism: React.ComponentType<SyntaxHighlighterProps>;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism" {
  export const oneDark: Record<string, React.CSSProperties>;
  export const oneLight: Record<string, React.CSSProperties>;
}
