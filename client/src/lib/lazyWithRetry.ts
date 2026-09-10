import { lazy, type ComponentType } from "react";
import { loadModule } from "./loadModule";

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(() => loadModule(importer));
}