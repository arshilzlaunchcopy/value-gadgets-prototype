import { MediaLibrary } from "@/components/admin/media-picker";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Media" };

export default function MediaPage() {
  return (
    <>
      <PageHeader title="Media library" description="Images for blocks, banners and the theme. Product photos live on the product editor." />
      <div className="bg-paper rounded-2xl border p-4">
        <MediaLibrary />
      </div>
    </>
  );
}
