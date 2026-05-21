import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Custom render that wraps components with necessary providers.
 * For now, components use Zustand stores directly, so no provider needed.
 * But we mock the DB module to prevent actual DB calls.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, options);
}

export { screen, fireEvent, waitFor, act } from "@testing-library/react";
