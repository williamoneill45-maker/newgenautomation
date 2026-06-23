import { redirect } from "next/navigation";

export default function InvoicesRedirectPage() {
  redirect("/billing/register");
}
