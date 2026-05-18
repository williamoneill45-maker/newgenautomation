# Family Law Automation Plan

## Core Workflow

1. Lawyer creates a matter/client file.
2. Lawyer completes one structured intake form.
3. Intake data is saved as structured matter data, not just UI text.
4. Every required Family Court document is created from the same saved matter data.
5. DOCX templates are filled by replacing placeholders such as `{{APPLICANT_NAME}}` and `{{COURT_LOCATION}}`.
6. Generated DOCX and PDF files are stored under the matter.
7. Final PDFs can be combined and page-arranged using Adobe PDF tooling or an equivalent server-side PDF assembly step.

## Required Documents

The system should assume all of these are created regardless of selected proceedings:

- Information Sheet
- Application for Confidential Address
- Application for Parenting Order
- Application for Protection Order
- Domestic Violence Affidavit
- Legal Aid Application Form
- Family Court Lawyer Certificate
- MSD Request and Police Information Sheet

## Data Model Direction

The intake form should write into reusable matter structures:

- matter
- applicant
- respondent
- children
- relationship details
- applications being filed
- previous applications and existing orders
- domestic violence notes
- uploaded templates
- generated documents
- generated files
- reminder/tasks

These structures should later map cleanly to Supabase tables.

## Supabase Direction

Supabase should be used for production persistence and file storage:

- `matters`
- `parties` or dedicated `applicants` / `respondents`
- `children`
- `intake_notes`
- `uploaded_templates`
- `generated_documents`
- `generated_files`
- `matter_tasks`
- Storage buckets for templates, generated files, legal aid screenshots, and supporting uploads

Row level security should be added before real client data is stored.

## Domestic Violence Drafting

The domestic violence affidavit needs a real-time drafting workflow:

1. Lawyer types notes into structured fields.
2. The client debounces changes and sends the latest notes to an API route.
3. The API route asks the drafting model for suggested wording for:
   - history of domestic violence
   - recent events
   - safety concerns if needed
4. The app shows AI draft text beside the notes.
5. The lawyer can edit or accept the draft.
6. Only lawyer-approved text is used in final documents.

The AI draft must not silently overwrite the lawyer's notes.

## Legal Aid Screenshot Nuance

The legal aid application form requires two screenshots later in the workflow, after the letter of engagement is signed and returned.

This should be modelled as matter tasks:

- `awaiting_signed_engagement_letter`
- `upload_legal_aid_screenshot_1`
- `upload_legal_aid_screenshot_2`
- `ready_for_legal_aid_pdf_assembly`

Screenshots should be stored under the matter and then included in the final PDF assembly.

## Adobe PDF Tools Direction

Adobe sync means Adobe PDF tools for combining PDFs and arranging pages. The document pipeline should therefore separate:

- DOCX placeholder merge
- DOCX-to-PDF conversion
- supporting upload collection
- PDF combine/reorder
- final file storage

This keeps the generated Family Court forms independent from the later final PDF bundle step.
