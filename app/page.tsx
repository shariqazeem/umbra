import { LandingNarrative } from "@/components/umbra/landing-narrative";

// Server component for SEO; the scroll-driven narrative is a client island.
export default function Home() {
  return <LandingNarrative />;
}
