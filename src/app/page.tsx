import { CampaignCockpit } from "@/components/CampaignCockpit";

// Home = the live operator cockpit. It reads LinkedIn through the browser's
// session (per-cookie token), so it renders client-side; this server page is
// just the mount point.
export default function CockpitPage() {
  return <CampaignCockpit />;
}
