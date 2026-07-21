import { FunnelView } from "@/components/FunnelView";

// Paid-ads funnel, stage by stage — reads the quiz DB + LinkedIn via the
// browser session, so it renders client-side.
export default function FunnelPage() {
  return <FunnelView />;
}
