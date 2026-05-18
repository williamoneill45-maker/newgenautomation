type FieldProps = {
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
};

const courts = [
  "Auckland Family Court",
  "Manukau Family Court",
  "Hamilton Family Court",
  "Wellington Family Court",
  "Christchurch Family Court",
];

const ethnicities = [
  "New Zealand European",
  "Maori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern / Latin American / African",
  "Other",
];

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-form">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  placeholder,
  required,
  type = "text",
  className = "",
}: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function TextArea({
  label,
  placeholder,
  className = "",
}: {
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <textarea
        rows={4}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function SelectField({
  label,
  placeholder,
  options,
  helper,
}: {
  label: string;
  placeholder: string;
  options: string[];
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <select
        defaultValue=""
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-600 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {helper ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function Checkbox({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-950">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      <span>{label}</span>
    </label>
  );
}

function ConfidentialToggle() {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-4">
      <span>
        <span className="block font-semibold text-slate-950">
          Confidential Address
        </span>
        <span className="mt-1 block text-sm text-slate-600">
          Keep applicant&apos;s address confidential from respondent.
        </span>
      </span>
      <input type="checkbox" className="peer sr-only" />
      <span className="relative h-6 w-10 shrink-0 rounded-full bg-slate-200 transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-sky-500 peer-checked:after:translate-x-4" />
    </label>
  );
}

function PersonDetails({ type }: { type: "Applicant" | "Respondent" }) {
  return (
    <Card title={`${type} Details`}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Full Name"
          placeholder={type === "Applicant" ? "Jane Doe" : ""}
          required={type === "Applicant"}
        />
        {type === "Respondent" ? (
          <Field
            label="Relationship to Applicant"
            placeholder="e.g. Spouse, Partner, Ex-partner"
          />
        ) : (
          <Field label="Date of Birth" placeholder="DD/MM/YYYY" />
        )}
        {type === "Respondent" ? (
          <Field label="Date of Birth" type="date" />
        ) : (
          <Field label="Occupation" />
        )}
        {type === "Respondent" ? (
          <Field label="Occupation" />
        ) : (
          <Field label="Mobile Phone" placeholder="021 xxx xxxx" />
        )}
        {type === "Respondent" ? (
          <Field label="Mobile Phone" placeholder="021 xxx xxxx" />
        ) : null}
        <Field label="Email Address" className="md:col-span-2" />
        <TextArea label="Home Address" className="md:col-span-2 lg:col-span-1" />
        <Field label="Post Code" />
        <TextArea label="Work Address" className="md:col-span-2" />
        <div>
          <SelectField
            label="Ethnic Origin"
            placeholder="Select ethnicity"
            options={ethnicities}
            helper="Ticks the matching box in the Information Sheet template."
          />
        </div>
        {type === "Applicant" ? (
          <div className="md:col-span-2">
            <ConfidentialToggle />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
              Family Law Automation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Matter Intake
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Capture the required details for protection, parenting, removal,
              and related Family Court applications.
            </p>
          </div>
          <button className="h-10 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
            Save intake
          </button>
        </header>

        <form className="space-y-6">
          <Card
            title="Applications Being Filed"
            description="Select all applications to be filed. These populate {{application_type_1}} through {{application_type_3}} in order."
          >
            <div className="space-y-4">
              <Checkbox label="Without Notice Application for Protection Order" />
              <Checkbox label="Without Notice Application for Parenting Order" />
              <Checkbox label="Order Preventing Removal from New Zealand" />
              <Checkbox label="Other" />
            </div>
          </Card>

          <Card title="Court Filing Details">
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="Court Location"
                placeholder="Select court"
                options={courts}
              />
              <Field label="FAM Number" placeholder="FAM-" />
            </div>
          </Card>

          <PersonDetails type="Applicant" />
          <PersonDetails type="Respondent" />

          <Card title="Relationship Details">
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Date of Marriage / Civil Union"
                placeholder="DD/MM/YYYY or N/A"
              />
              <Field label="Place of Marriage / Civil Union" />
              <Field label="De Facto Relationship Start" placeholder="DD/MM/YYYY" />
              <Field label="Relationship End Date" placeholder="DD/MM/YYYY" />
            </div>
          </Card>

          <Card
            title="Children Affected by the Application"
            description="Details of children involved in the matter."
          >
            <div className="flex justify-end">
              <button
                type="button"
                className="mb-5 h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-slate-50"
              >
                + Add Child
              </button>
            </div>
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">
              No children added.
            </div>
          </Card>

          <Card title="Previous Applications & Existing Orders">
            <div className="space-y-5">
              <TextArea
                label="Previous Applications"
                placeholder="Describe any previous applications"
              />
              <TextArea
                label="Existing Orders Between Parties"
                placeholder="List any existing orders"
              />
              <TextArea
                label="Existing Orders Relating to Children"
                placeholder="List any existing orders relating to children"
              />
            </div>
          </Card>

          <Card
            title="Domestic Violence - Background Notes"
            description="These notes are used by AI to generate the affidavit wording. They are not directly inserted into documents."
          >
            <div className="space-y-5">
              <TextArea
                label="History of Family Violence"
                placeholder="Describe the history of family violence..."
              />
              <TextArea
                label="Recent Events (triggering this application)"
                placeholder="Describe the most recent events..."
              />
              <TextArea
                label="Safety Concerns"
                placeholder="Describe urgent safety concerns, risks, or practical issues..."
              />
            </div>
          </Card>
        </form>
      </div>
    </main>
  );
}
