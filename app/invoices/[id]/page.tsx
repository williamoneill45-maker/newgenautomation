import { redirect } from "next/navigation";

export default async function InvoiceDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/billing/register?record=${encodeURIComponent(id)}`);
}
