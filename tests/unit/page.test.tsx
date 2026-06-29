import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The landing's smooth-scroll + 3D pool scene are browser-only (Lenis / scroll-linked
// motion); stub them so the content renders cleanly under jsdom.
vi.mock("@/components/umbra/cinematic", () => ({
  SmoothScroll: () => null,
  CinematicBackground: () => null,
}));
vi.mock("@/components/umbra/pool-scene", () => ({ PoolScene: () => null }));

import Home from "@/app/page";

describe("Home (landing page)", () => {
  it("renders the Umbra wordmark", () => {
    render(<Home />);
    expect(screen.getAllByText("Umbra").length).toBeGreaterThan(0);
  });

  it("states the privacy-layer positioning", () => {
    render(<Home />);
    expect(screen.getByText("The privacy layer for Stellar")).toBeInTheDocument();
  });

  it("shows the hero headline and primary CTA into the wallet", () => {
    render(<Home />);
    expect(screen.getByText("Private money")).toBeInTheDocument();
    expect(screen.getByText("Open the wallet")).toBeInTheDocument();
  });
});
