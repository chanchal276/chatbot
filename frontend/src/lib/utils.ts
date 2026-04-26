import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number) {
  if (!bytes) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function truncate(text: string, length = 120) {
  return text.length <= length ? text : `${text.slice(0, length)}...`;
}

export function getSourceLabel(source: string) {
  if (source.startsWith("http")) {
    try {
      return `🌐 ${new URL(source).hostname.replace("www.", "")}`;
    } catch {
      return `🌐 ${source}`;
    }
  }
  return `📄 ${source}`;
}

export function estimateSourcePreview(source: string) {
  if (source.startsWith("http")) return "Open the cited web source in a new tab.";
  return "Referenced uploaded document from your research library.";
}
