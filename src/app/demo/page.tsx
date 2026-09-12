import { DemoPanel } from "@/components/demo/demo-panel";
import { loadPanelData } from "./data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Demo control panel", robots: { index: false, follow: false } };

export default async function DemoPage() {
  const data = await loadPanelData();
  return <DemoPanel data={data} />;
}
