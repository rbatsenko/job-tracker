/**
 * The kinds of work the board knows about. One list drives three things: the
 * "Field" filter on the board, the ranking presets, and the placeholder hints
 * in the profile form. A listing's field is read from its title.
 */
export type Field = {
  key: string;
  label: string;
  /** Title words that mark this field. Checked in list order, first match wins. */
  titles: readonly string[];
  skills: readonly string[];
  secondary: readonly string[];
  topics: readonly string[];
  /** Placeholder for the skills box. */
  hint: string;
};

export const FIELDS: readonly Field[] = [
  {
    key: "data",
    label: "Data",
    titles: [
      "data engineer", "data scientist", "data analyst", "analytics engineer", "machine learning",
      "ml engineer", "research scientist", "business intelligence", "bi analyst", "bi specialist", "bi developer",
      "data science", "big data", "data lakehouse", "data platform", "analytics",
    ],
    skills: ["sql", "python", "pandas", "machine learning", "statistics", "dbt", "spark", "tableau", "looker", "power bi"],
    secondary: ["r ", "airflow", "snowflake", "bigquery", "databricks", "tensorflow", "pytorch", "scikit", "excel", "etl"],
    topics: ["ai", "llm", "forecasting", "experimentation", "analytics engineering", "b2b", "saas"],
    hint: "sql, python, dbt",
  },
  {
    key: "design",
    label: "Design",
    titles: [
      "designer", "ux", "ui/ux", "ux/ui", "user research", "product design", "design lead", "head of design",
      "design director", "design manager", "illustrator", "motion", "visual design", "brand design",
      "graphic design", "creative director", "art director",
    ],
    skills: [
      "figma", "design system", "design systems", "prototyping", "prototype", "user research",
      "interaction design", "ux", "ui", "wireframe", "usability", "product design",
    ],
    secondary: [
      "sketch", "framer", "webflow", "adobe", "illustrator", "photoshop", "after effects", "motion design",
      "typography", "accessibility", "wcag", "user testing", "design token", "storybook", "html", "css",
    ],
    topics: ["ai", "design ops", "designops", "0 to 1", "zero to one", "b2b", "saas", "mobile", "brand", "content design"],
    hint: "figma, design systems, user research",
  },
  {
    key: "marketing",
    label: "Marketing",
    titles: [
      "marketing", "seo", "content", "copywriter", "writer", "editor", "communications", "social media",
      "brand manager", "demand generation", "growth manager", "community manager", "pr manager",
    ],
    skills: [
      "seo", "content marketing", "paid media", "google ads", "hubspot", "email marketing", "copywriting",
      "social media", "brand", "growth marketing",
    ],
    secondary: ["analytics", "ga4", "webflow", "figma", "crm", "marketing automation", "lifecycle", "ppc", "sem", "influencer"],
    topics: ["b2b", "saas", "product-led", "demand generation", "community", "events", "ai"],
    hint: "seo, hubspot, content",
  },
  {
    key: "product",
    label: "Product",
    titles: ["product manager", "product owner", "product lead", "head of product", "product director", "vp product", "chief product"],
    skills: ["product management", "roadmap", "discovery", "user research", "a/b testing", "analytics", "agile", "scrum", "jira", "prd"],
    secondary: ["sql", "figma", "mixpanel", "amplitude", "okr", "stakeholder", "kpi", "experimentation", "api", "platform"],
    topics: ["b2b", "saas", "ai", "platform", "growth", "fintech", "marketplace"],
    hint: "roadmaps, discovery, b2b saas",
  },
  {
    key: "sales",
    label: "Sales",
    titles: [
      "sales", "account executive", "account manager", "business development", "sdr", "bdr",
      "partnerships", "revenue", "solutions engineer", "solution engineer", "pre-sales", "presales",
    ],
    skills: ["sales", "pipeline", "quota", "prospecting", "salesforce", "hubspot", "negotiation", "demos", "outbound", "closing"],
    secondary: ["crm", "linkedin", "apollo", "outreach", "gong", "partnerships", "enterprise", "smb", "mid-market", "renewals"],
    topics: ["b2b", "saas", "fintech", "startup", "remote-first", "ai"],
    hint: "salesforce, outbound, enterprise",
  },
  {
    key: "support",
    label: "Customer support",
    titles: [
      "customer support", "customer success", "customer service", "support specialist", "technical support",
      "support engineer", "help desk", "helpdesk", "support agent", "customer care",
    ],
    skills: [
      "customer support", "zendesk", "intercom", "troubleshooting", "customer success", "onboarding",
      "ticketing", "sla", "empathy", "communication",
    ],
    secondary: ["hubspot", "salesforce", "jira", "sql", "api", "saas", "knowledge base", "chat", "phone", "technical support"],
    topics: ["b2b", "saas", "fintech", "startup", "ai", "multilingual"],
    hint: "zendesk, onboarding, technical support",
  },
  {
    key: "people",
    label: "People & HR",
    titles: [
      "recruiter", "recruiting", "talent", "people ops", "people operations", "people partner",
      "human resources", "hr manager", "hr business partner", "hr generalist", "hr specialist", "hr lead",
      "hr director", "hr coordinator", "head of hr", "hrbp", "hris", "learning and development", "people lead", "head of people",
    ],
    skills: [
      "recruiting", "sourcing", "talent acquisition", "onboarding", "hr", "people operations",
      "employee experience", "performance", "compensation", "payroll",
    ],
    secondary: ["greenhouse", "lever", "ashby", "workday", "bamboohr", "linkedin recruiter", "employer branding", "l&d", "benefits", "hris"],
    topics: ["remote-first", "startup", "scale-up", "global", "eor", "culture"],
    hint: "sourcing, greenhouse, people ops",
  },
  {
    key: "finance",
    label: "Finance",
    titles: [
      "finance", "financial", "accountant", "accounting", "controller", "bookkeeper", "payroll",
      "fp&a", "treasury", "tax ", "auditor",
    ],
    skills: [
      "accounting", "financial analysis", "budgeting", "forecasting", "excel", "financial modelling",
      "financial modeling", "reporting", "gaap", "ifrs",
    ],
    secondary: ["netsuite", "quickbooks", "xero", "sql", "power bi", "tax", "payroll", "treasury", "controlling", "fp&a"],
    topics: ["saas", "fintech", "startup", "crypto", "ai"],
    hint: "excel, fp&a, ifrs",
  },
  {
    key: "engineering",
    label: "Engineering",
    titles: [
      "engineer", "engineering", "developer", "programmer", "programador", "software", "architect", "devops",
      "sre", "site reliability", "qa", "quality assurance", "tester", "security", "cto", "technical lead",
      "tech lead", "full stack", "fullstack", "frontend", "front-end", "front end", "backend", "back-end",
      "back end", "network administrator", "system administrator", "sysadmin", "drupal", "wordpress",
    ],
    skills: [
      "typescript", "react", "next.js", "nextjs", "react native", "expo", "node", "node.js", "javascript",
    ],
    secondary: [
      "kotlin", "spring", "spring boot", "kafka", "postgres", "postgresql", "supabase", "express", "graphql",
      "aws", "docker", "datadog", "cypress", "playwright", "swift", "swiftui", "python", "go ", "rust", "java",
    ],
    topics: ["ai", "llm", "agent", "mcp", "openai", "anthropic", "rag", "integrations", "developer tools", "devtools", "mobile"],
    hint: "typescript, react, node",
  },
  {
    key: "operations",
    label: "Operations",
    titles: [
      "operations", "project manager", "program manager", "chief of staff", "executive assistant",
      "virtual assistant", "office assistant", "personal assistant", "office manager", "legal", "counsel",
      "compliance", "procurement", "logistics", "scrum master", "delivery manager", "administrative", "administrator",
      "admin assistant", "lawyer", "paralegal",
    ],
    skills: [
      "operations", "project management", "program management", "process", "stakeholder management",
      "planning", "jira", "asana", "notion", "coordination",
    ],
    secondary: ["scrum", "agile", "pmp", "okr", "budgeting", "vendor management", "logistics", "procurement", "legal", "compliance"],
    topics: ["startup", "scale-up", "remote-first", "ai", "saas"],
    hint: "asana, process, stakeholders",
  },
  {
    key: "other",
    label: "Something else",
    titles: [],
    skills: [],
    secondary: [],
    topics: [],
    hint: "the words that should appear in a listing",
  },
];

export const FIELD_BY_KEY: Record<string, Field> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const getField = (key?: string | null) => FIELD_BY_KEY[key ?? ""] ?? FIELD_BY_KEY.other;
export const fieldLabel = (key: string) => getField(key).label;

const escape = (s: string) => s.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = FIELDS.filter((f) => f.titles.length).map((f) => ({
  key: f.key,
  re: new RegExp(`(^|[^a-z])(${f.titles.map(escape).join("|")})([^a-z]|$)`, "i"),
}));

/** Which field a job title belongs to, or "other" when the title gives nothing away. */
export function fieldOf(title: string): string {
  return MATCHERS.find((m) => m.re.test(title))?.key ?? "other";
}
