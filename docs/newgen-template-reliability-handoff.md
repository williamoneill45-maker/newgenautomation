# NewGen Template Reliability Handoff

## Objective

NewGen is already the core product and should remain the source of truth for matters, intake data, billing, legal aid, and document generation. The next phase is not primarily a migration to Plumsail. The next phase is to make NewGen's document/template system more reliable, easier to audit, easier to duplicate for other workflows or lawyers, and less dependent on code pushes for routine template changes.

The desired outcome is a NewGen "Template Studio" style system that gives the useful parts of Plumsail inside NewGen:

- visible placeholders
- clear field mapping
- test generation
- workflow-level document bundles
- explicit conditional logic
- template versioning
- easy upload/edit of templates without developer intervention

## Current Problems

### 1. Placeholder inconsistency

Templates currently contain or have recently contained multiple names for the same concept:

- `{{APPLICANT_NAME}}`
- `{{Applicant_Name}}`
- `{{applicant_name}}`
- `{{applicant_fullname}}`
- `{{RESPONDENT_NAME}}`
- `{{Respondents_name}}`
- misspellings such as `APPLCIANT`, `Appliant`, `Respondnet`, `captals`

This causes avoidable generation failures and makes it hard for a non-developer to know whether a template is safe.

### 2. Conditional logic is hidden

Important document choices are currently spread across templates, generation code, and matter data. Examples:

- protection order only
- parenting order only
- protection plus parenting
- confidential address required
- legal aid granted
- fee waiver required
- consented protected person
- family violence category selections

The lawyer/user should be able to see why a document is included and which paragraphs are inserted or omitted.

### 3. Date and formatting rules are not standardised

Different templates use different date placeholders and wording:

- `{{date_today}}`
- `{{date_today_long}}`
- `{{month_day}} day of {{month}} {{year}}`
- legacy text such as `Dated this {{dd day of month year}}`

There should be a clear field policy:

- ordinary signature/date fields use `{{date_today}}`
- formal court signing lines use `{{month_day}} day of {{month}} {{year}}`
- letters use `{{date_today_long}}`

### 4. Template editing requires too much developer involvement

At present, a template correction often means:

1. edit a Word file
2. change repo assets
3. update code if placeholder names changed
4. run generation tests
5. commit/push/deploy

This is too heavy for routine wording or layout changes.

### 5. Testing is too bundle-oriented

The app needs better single-template testing. The user should be able to test one template against one matter before running a whole document pack.

### 6. Waste in template/code practices

There is too much duplication and legacy compatibility:

- old placeholder aliases kept indefinitely
- repeated document-specific rules in code
- `.doc` templates that should be converted to `.docx`
- static templates mixed with generated templates
- inconsistent names between template files, app document IDs, and workflow labels
- no clear ownership boundary between intake fields, derived fields, template formatting, and document workflow rules

## Target Architecture

NewGen should have four clear layers.

### 1. Intake Layer

The lawyer enters information once.

Examples:

- applicant full name
- respondent full name
- court
- FAM number
- children
- relationship dates
- proceedings required
- family violence categories
- legal aid status
- billing information

The lawyer should not enter duplicate values such as first name, surname, full name, and uppercase surname separately.

### 2. Field Dictionary Layer

NewGen derives standard fields from the intake.

Examples:

- `applicant_name`
- `applicant_first_name`
- `applicant_last_name`
- `applicant_last_name_upper`
- `respondent_name`
- `respondent_first_name`
- `respondent_last_name`
- `respondent_last_name_upper`
- `court_location`
- `court_location_maori`
- `date_today`
- `date_today_long`
- `month_day`
- `month`
- `year`

This field dictionary should be visible in the app under Settings.

Each field should show:

- field key
- plain-English description
- example value
- source intake field
- whether it is derived
- formatting expectation

### 3. Template Layer

Templates should be uploaded and managed through the app.

Each template should store:

- title
- document type
- workflow category
- active version
- upload date
- uploaded by
- detected placeholders
- unknown placeholders
- warning status
- optional static/dynamic flag

NewGen should scan uploaded DOCX files for placeholders and report issues before a template becomes active.

### 4. Workflow Layer

Document bundles should be explicit workflows.

Examples:

- Protection Order
- Parenting Order
- Protection + Parenting
- Legal Aid
- Billing/Invoice

Each workflow should list:

- included documents
- order of generation
- include/exclude condition
- required fields
- optional fields
- output filename pattern

## Template Studio MVP

Build a new area in NewGen:

`Settings -> Templates`

### Feature 1: Field Dictionary

Create a canonical list of allowed fields.

Minimum fields:

- `applicant_name`
- `applicant_first_name`
- `applicant_last_name`
- `applicant_last_name_upper`
- `applicant_home_address`
- `applicant_phone`
- `applicant_email`
- `applicant_dob`
- `applicant_age`
- `applicant_occupation`
- `respondent_name`
- `respondent_first_name`
- `respondent_last_name`
- `respondent_last_name_upper`
- `respondent_home_address`
- `respondent_phone`
- `respondent_email`
- `respondent_dob`
- `respondent_age`
- `respondent_occupation`
- `respondent_work_address`
- `respondent_relationship_to_applicant`
- `court_location`
- `court_location_maori`
- `fam_number`
- `legal_aid_number`
- `date_today`
- `date_today_long`
- `month_day`
- `month`
- `year`
- `relationship_start_date`
- `relationship_end_date`
- `child_1_name`
- `child_1_firstname`
- `child_1_dob`
- `child_1_age`
- `child_2_name`
- `child_2_firstname`
- `child_2_dob`
- `child_2_age`
- `child_3_name`
- `child_3_firstname`
- `child_3_dob`
- `child_3_age`
- `family_violence_categories`

### Feature 2: Template Upload

Allow DOCX upload from the browser.

On upload:

1. store the template file
2. extract all `{{placeholder}}` tokens
3. check each placeholder against the field dictionary
4. flag unknown placeholders
5. flag malformed braces
6. flag spaces or uppercase characters in placeholder keys
7. show a preview report

Do not allow activation if critical errors exist.

### Feature 3: Placeholder Scanner

Scanner should detect:

- valid placeholders
- unknown placeholders
- malformed placeholders
- old aliases
- spelling mistakes
- duplicate fields
- template fields that no longer exist in NewGen

Example output:

```text
05 Protection Order application.docx

Known:
{{applicant_name}}
{{respondent_name}}
{{court_location}}

Unknown:
{{dd day of month year}}

Suggested:
Use {{month_day}} day of {{month}} {{year}}
```

### Feature 4: Template Preview

Allow the user to generate one document from one selected matter.

Inputs:

- template
- matter
- output format

Output:

- generated DOCX
- placeholder replacement report
- remaining unreplaced placeholders
- missing required fields

### Feature 5: Workflow Builder

Create editable workflows.

Example workflow: Protection Order

Documents:

1. FV Information Sheet
2. Protection Order Application
3. FV Affidavit
4. Police Information Sheet
5. Lawyer Certificate
6. Court Filing DV Applications Letter
7. Confidential Address Application, conditional
8. Legal Aid Confirming Letter, conditional
9. MSD Request, conditional
10. Fee Waiver, conditional/static

Each document should have:

- template version
- output filename
- include condition
- required fields

### Feature 6: Versioning and Rollback

Every uploaded template should create a new version.

Example:

```text
Protection Order Application
v1 - 9 Sept 2026
v2 - 12 Sept 2026
Active: v2
```

The user should be able to switch the active version back to v1 if v2 breaks.

## Reliability Practices

### Standardise field naming

Use only lowercase snake_case in templates.

Good:

```text
{{applicant_name}}
{{respondent_name}}
{{date_today}}
```

Avoid:

```text
{{APPLICANT_NAME}}
{{Applicant_Name}}
{{Respondents_name}}
{{dd day of month year}}
```

### Separate data, formatting, and logic

Data should come from NewGen fields.

Formatting should live in Word template styling.

Logic should live in NewGen workflow rules, not hidden in random template wording.

### Keep legal document packs explicit

Do not rely on one giant "generate everything" path. Use named workflows:

- Protection Order
- Parenting Order
- Protection + Parenting
- Legal Aid
- Billing

### Reduce legacy aliases

Support old placeholder aliases only temporarily. Add a migration report and remove old aliases after templates are normalised.

### Prefer DOCX over DOC

All active templates should be `.docx`. Keep `.doc` originals only as archive backups.

### Add pre-generation checks

Before generating documents, NewGen should check:

- all selected templates exist
- all placeholders are recognised
- required fields are present
- conditional documents have enough data
- no unreplaced placeholders remain after merge

### Add post-generation checks

After generating documents, NewGen should report:

- files generated
- fields replaced
- missing fields
- unreplaced placeholders
- any skipped documents and why

## Proposed Database Objects

### template_fields

Stores canonical field definitions.

Suggested columns:

- `key`
- `label`
- `description`
- `example_value`
- `source`
- `derived`
- `format`
- `active`

### document_templates

Stores template metadata.

Suggested columns:

- `id`
- `title`
- `document_type`
- `workflow_category`
- `active_version_id`
- `created_at`
- `updated_at`

### document_template_versions

Stores uploaded files and scan results.

Suggested columns:

- `id`
- `template_id`
- `version_number`
- `storage_path`
- `uploaded_by`
- `uploaded_at`
- `detected_placeholders`
- `unknown_placeholders`
- `malformed_placeholders`
- `status`

### document_workflows

Stores workflow definitions.

Suggested columns:

- `id`
- `name`
- `description`
- `active`

### document_workflow_items

Stores the documents inside each workflow.

Suggested columns:

- `id`
- `workflow_id`
- `template_id`
- `sort_order`
- `include_condition`
- `output_filename_pattern`
- `required_fields`

## Implementation Phases

### Phase 1: Audit and Canonical Field Dictionary

Deliverables:

- canonical field list
- field dictionary module in code
- Settings page to view fields
- template scanner utility
- CLI or app button to audit current templates

### Phase 2: Template Upload and Scan

Deliverables:

- upload UI
- Supabase storage for templates
- placeholder extraction
- warning report
- activation guard

### Phase 3: Single Template Preview

Deliverables:

- select matter
- select template
- generate preview DOCX
- show missing/replaced/unreplaced field report

### Phase 4: Workflow Builder

Deliverables:

- workflow list
- workflow detail page
- document ordering
- include conditions
- workflow preview

### Phase 5: Versioning and Cleanup

Deliverables:

- version history
- rollback
- active version switching
- archive old templates
- remove redundant legacy aliases

## Acceptance Criteria

The system is ready when:

- a user can upload a new DOCX without a code push
- NewGen detects every placeholder in that DOCX
- unknown placeholders are clearly shown
- malformed placeholders are blocked
- a user can preview one document from one matter
- a user can run Protection Order, Parenting Order, or Protection + Parenting workflows
- generated documents report unreplaced placeholders
- old template versions can be restored
- all active templates use lowercase snake_case fields

## Immediate Next Build Recommendation

Build the following first:

1. `Settings -> Template Fields`
2. `Settings -> Templates`
3. DOCX placeholder scanner
4. template upload with validation
5. single-template preview using a selected matter

This gives most of the Plumsail-like value while preserving NewGen as the central product.

