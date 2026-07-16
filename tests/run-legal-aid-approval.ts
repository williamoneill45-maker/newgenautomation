import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { POST } from "../app/api/generate-legal-aid/route.ts";
import { confidentialLawyerPostalAddress, type LegalAidReview } from "../lib/legal-aid.ts";

const review: LegalAidReview = {
  matterId: "legal-aid-approval",
  title: "Mr",
  clientName: "WILLIAM O'NEILL",
  dob: "17/04/1988",
  homeAddress: confidentialLawyerPostalAddress,
  lawyerPostalAddress: confidentialLawyerPostalAddress,
  mobilePhone: "021 555 0123",
  email: "william.oneill@example.com",
  numberOfChildren: "1",
  courtLocation: "Auckland Court",
  proceedingsType: "Protection and Parenting Orders",
  protectionOrderWording: "Protection Order sought without notice.",
  parentingOrderWording: "Parenting Order sought without notice.",
  abuseSummary: "Urgent protection is required.",
  dateToday: "16/07/2026",
};

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const form = new FormData();
form.set("review", JSON.stringify(review));
form.set("incomeProof", new File([png], "income-proof.png", { type: "image/png" }));
form.set("signedPage", new File([png], "signed-page.png", { type: "image/png" }));

const response = await POST(new Request("http://localhost/api/generate-legal-aid", {
  method: "POST",
  body: form,
}));
if (!response.ok) throw new Error(`Legal Aid generator returned ${response.status}: ${await response.text()}`);

const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "legal-aid-approval");
await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "Legal Aid Application - WILLIAM ONEILL.pdf");
await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
console.log(outputPath);
