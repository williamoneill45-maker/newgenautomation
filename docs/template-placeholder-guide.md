# Template Placeholder Guide

## Canonical Rule

The Information Sheet is the source of truth for placeholder naming. Every other DOCX template should reuse the same placeholder keys exactly.

Use uppercase snake case wrapped in double braces:

```text
{{APPLICANT_NAME}}
{{RESPONDENT_NAME}}
{{APPLICANT_ADDRESS}}
{{RESPONDENT_ADDRESS}}
{{COURT_LOCATION}}
{{CHILD_1_NAME}}
{{CHILD_1_DOB}}
{{CHILD_1_AGE}}
{{APPLICATION_TYPE_1}}
```

## Blank Fields

Generated documents must never show `undefined`, `null`, or similar programming values.

The merge layer normalizes missing values to an empty string before replacement. If a lawyer leaves a field blank, the final document should simply leave that area blank.

## Word Template Formatting

For the cleanest DOCX replacement:

- Put each placeholder exactly where the answer should appear.
- Keep the full placeholder in one Word run where possible. Avoid styling only part of a placeholder.
- Apply the desired final formatting to the placeholder text itself.
- Do not use placeholder names with spaces or punctuation other than underscores.
- Do not place placeholders inside text boxes unless we have tested that document with the merge engine.

## Long and Short Names

The merge engine should replace only the placeholder text and preserve the surrounding Word formatting. A short name will leave surrounding blank space. A long name will wrap according to the Word table cell, paragraph, or line settings.

To keep layouts stable:

- Put names and addresses in table cells or paragraph areas that can wrap.
- Avoid fixed-width underlines that are too short for real names.
- Avoid manually spacing with repeated spaces.
- Use table borders or bottom borders for form lines rather than typed underscores.
- Test each final template with a very short name and a deliberately long name before using it in production.

## PDF Forms

PDF forms, including the legal aid application, may need a different fill strategy from DOCX templates. Keep the same canonical field names in code, but map them to PDF form field names or page coordinates separately.
