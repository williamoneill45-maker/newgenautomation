import assert from "node:assert/strict";

import {
  emptyOrdersSought,
  formatApplications,
  getRelevantLegislation,
  type NoticeType,
  type OrdersSought,
} from "../lib/application-orders.ts";

type TestCase = {
  name: string;
  noticeType: Exclude<NoticeType, "">;
  ordersSought: Partial<OrdersSought>;
  applications: string;
  relevantLegislation: string;
};

const cases: TestCase[] = [
  {
    name: "Without Notice Protection",
    noticeType: "without_notice",
    ordersSought: { protection: true },
    applications: "Without Notice Application for Protection Order",
    relevantLegislation: "Family Violence Act 2018, ss 60 and 75",
  },
  {
    name: "On Notice Protection",
    noticeType: "on_notice",
    ordersSought: { protection: true },
    applications: "On Notice Application for Protection Order",
    relevantLegislation: "Family Violence Act 2018, s 60",
  },
  {
    name: "Without Notice Parenting",
    noticeType: "without_notice",
    ordersSought: { parenting: true },
    applications: "Without Notice Application for Parenting Order",
    relevantLegislation: "Care of Children Act 2004, ss 48 and 49",
  },
  {
    name: "On Notice Parenting",
    noticeType: "on_notice",
    ordersSought: { parenting: true },
    applications: "On Notice Application for Parenting Order",
    relevantLegislation: "Care of Children Act 2004, ss 48 and 49",
  },
  {
    name: "Without Notice Protection + Parenting",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true },
    applications: "Without Notice Application for Protection and Parenting Orders",
    relevantLegislation: "Family Violence Act 2018, ss 60 and 75; Care of Children Act 2004, ss 48 and 49",
  },
  {
    name: "On Notice Protection + Parenting",
    noticeType: "on_notice",
    ordersSought: { protection: true, parenting: true },
    applications: "On Notice Application for Protection and Parenting Orders",
    relevantLegislation: "Family Violence Act 2018, s 60; Care of Children Act 2004, ss 48 and 49",
  },
  {
    name: "Without Notice Tenancy",
    noticeType: "without_notice",
    ordersSought: { tenancy: true },
    applications: "Without Notice Application for Tenancy Order",
    relevantLegislation: "Family Violence Act 2018, ss 121 and 122",
  },
  {
    name: "Without Notice Ancillary Furniture",
    noticeType: "without_notice",
    ordersSought: { ancillaryFurniture: true },
    applications: "Without Notice Application for Ancillary Furniture Order",
    relevantLegislation: "Family Violence Act 2018, ss 127 and 128",
  },
  {
    name: "Without Notice Protection + Tenancy",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true },
    applications: "Without Notice Application for Protection and Tenancy Orders",
    relevantLegislation: "Family Violence Act 2018, ss 60, 75, 121 and 122",
  },
  {
    name: "Without Notice Protection + Parenting + Tenancy + Ancillary Furniture",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    applications: "Without Notice Application for Protection, Parenting, Tenancy and Ancillary Furniture Orders",
    relevantLegislation: "Family Violence Act 2018, ss 60, 75, 121, 122, 127 and 128; Care of Children Act 2004, ss 48 and 49",
  },
];

for (const testCase of cases) {
  const ordersSought = { ...emptyOrdersSought, ...testCase.ordersSought };
  const applications = formatApplications({ noticeType: testCase.noticeType, ordersSought });
  const relevantLegislation = getRelevantLegislation({ noticeType: testCase.noticeType, ordersSought });

  assert.equal(applications, testCase.applications, `${testCase.name} applications`);
  assert.equal(relevantLegislation, testCase.relevantLegislation, `${testCase.name} legislation`);
  console.log(`${testCase.name}\napplications: ${applications}\nrelevant_legislation: ${relevantLegislation}\n`);
}
