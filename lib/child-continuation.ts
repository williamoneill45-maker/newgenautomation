import type { MatterFile } from "./matter";

function formatChildDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function buildAdditionalChildLines(matter: MatterFile, templateCapacity = 3): string[] {
  return matter.intake.children.slice(templateCapacity).map((child, offset) => {
    const details = [
      child.fullName.toLocaleUpperCase("en-NZ"),
      child.dateOfBirth ? `born ${formatChildDate(child.dateOfBirth)}` : "date of birth not supplied",
      child.gender ? `gender ${child.gender}` : "",
      child.livingWithName ? `living with ${child.livingWithName.toLocaleUpperCase("en-NZ")}` : "",
      child.applicantRelationshipToChild ? `Applicant: ${child.applicantRelationshipToChild}` : "",
      child.respondentRelationshipToChild ? `Respondent: ${child.respondentRelationshipToChild}` : "",
    ].filter(Boolean);
    return `${templateCapacity + offset + 1}. ${details.join("; ")}.`;
  });
}
