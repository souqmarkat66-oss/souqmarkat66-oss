export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed|Failed to load module script/i.test(message);
}

/** Retry a failed code download once, never application/API/payment operations. */
export async function loadModule<T>(
  importer: () => Promise<T>,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 350)),
): Promise<T> {
  try {
    return await importer();
  } catch (error) {
    if (!isModuleLoadError(error)) throw error;
    await pause();
    return importer();
  }
}