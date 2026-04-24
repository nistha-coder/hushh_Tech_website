// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = {
  status: "booting",
  session: null as { user?: { id?: string } } | null,
};
const onboardingProgressMock = vi.fn();

vi.mock("../src/auth/AuthSessionProvider", () => ({
  useAuthSession: () => ({
    status: authState.status,
    session: authState.session,
  }),
}));

vi.mock("../src/resources/config/config", () => ({
  default: {
    supabaseClient: {},
  },
}));

vi.mock("../src/services/onboarding/progress", () => ({
  fetchResolvedOnboardingProgress: (...args: unknown[]) =>
    onboardingProgressMock(...args),
}));

import ProtectedRoute from "../src/components/ProtectedRoute";

describe("ProtectedRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    authState.status = "booting";
    authState.session = null;
    onboardingProgressMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps showing the loading state while auth is booting", async () => {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/profile"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/profile",
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement("div", null, "protected content")
              ),
            })
          )
        )
      );
    });

    await flush();

    expect(container.textContent).toContain("Loading...");
    expect(container.textContent).not.toContain("protected content");
  });

  it("allows the investor-profile alias once the financial-link gate is cleared", async () => {
    authState.status = "authenticated";
    authState.session = { user: { id: "user-123" } };
    onboardingProgressMock.mockResolvedValue({
      current_step: 1,
      is_completed: false,
      financial_link_status: "completed",
    });

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/investor-profile"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/investor-profile",
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement("div", null, "protected content")
              ),
            })
          )
        )
      );
    });

    await flush();

    expect(container.textContent).toContain("protected content");
  });

  it("ignores stale async onboarding checks and keeps latest authorization outcome", async () => {
    authState.status = "authenticated";
    authState.session = { user: { id: "user-1" } };

    let resolveFirst:
      | ((value: {
          current_step: number;
          is_completed: boolean;
          financial_link_status: string;
        }) => void)
      | null = null;
    const firstPromise = new Promise<{
      current_step: number;
      is_completed: boolean;
      financial_link_status: string;
    }>((resolve) => {
      resolveFirst = resolve;
    });

    let callCount = 0;
    onboardingProgressMock.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) return firstPromise;
      return Promise.resolve({
        current_step: 1,
        is_completed: false,
        financial_link_status: "completed",
      });
    });

    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/profile"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/profile",
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement("div", null, "protected content")
              ),
            }),
            React.createElement(Route, {
              path: "/onboarding/financial-link",
              element: React.createElement("div", null, "financial-link page"),
            })
          )
        )
      );
    });

    authState.session = { user: { id: "user-2" } };
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/profile"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/profile",
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement("div", null, "protected content")
              ),
            }),
            React.createElement(Route, {
              path: "/onboarding/financial-link",
              element: React.createElement("div", null, "financial-link page"),
            })
          )
        )
      );
    });

    await flush();
    expect(container.textContent).toContain("protected content");

    resolveFirst?.({
      current_step: 1,
      is_completed: false,
      financial_link_status: "pending",
    });
    await flush();

    expect(container.textContent).toContain("protected content");
    expect(container.textContent).not.toContain("financial-link page");
  });
});
