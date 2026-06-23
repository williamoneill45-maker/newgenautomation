import { redirect } from "next/navigation";

export default function ClaimsRedirectPage() {
  redirect("/billing/register");
}
