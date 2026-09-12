import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/product-editor";
import { loadEditor } from "../editor-loader";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "new" && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadEditor(id === "new" ? null : id);
  return <ProductEditor data={data} />;
}
