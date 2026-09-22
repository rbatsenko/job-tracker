/**
 * Roman's profile, as the scorer sees it. Edit the weights here and every job
 * is rescored on the next refresh (or via POST /api/refresh { rescore: true }).
 */
export const PROFILE = {
  baseCountry: "PL",
  timezone: "CET",

  /** Things worth a lot: the core of the last decade of work. */
  coreStack: [
    "typescript",
    "react",
    "next.js",
    "nextjs",
    "react native",
    "expo",
    "node",
    "node.js",
    "javascript",
  ],

  /** Real, but secondary. */
  secondaryStack: [
    "kotlin",
    "spring",
    "spring boot",
    "kafka",
    "postgres",
    "postgresql",
    "supabase",
    "express",
    "graphql",
    "aws",
    "docker",
    "datadog",
    "cypress",
    "playwright",
    "swift",
    "swiftui",
  ],

  /** Where the interesting work is right now. */
  bonusTopics: [
    "ai",
    "llm",
    "agent",
    "mcp",
    "anthropic",
    "claude",
    "openai",
    "ai sdk",
    "rag",
    "integrations",
    "developer tools",
    "devtools",
    "mobile",
  ],

  /** Titles that fit. */
  goodTitles: [
    "senior",
    "staff",
    "lead",
    "principal",
    "full stack",
    "fullstack",
    "full-stack",
    "frontend",
    "front end",
    "front-end",
    "backend",
    "back end",
    "back-end",
    "software engineer",
    "product engineer",
    "mobile engineer",
    "founding engineer",
    "web engineer",
  ],

  /** Titles to push down: not what he does. */
  badTitles: [
    "embedded",
    "firmware",
    "hardware",
    "asic",
    "mechanical",
    "machine learning engineer",
    "ml engineer",
    "research scientist",
    "data scientist",
    "data engineer",
    "devops",
    "site reliability",
    " sre",
    "security engineer",
    "qa engineer",
    "sales",
    "account executive",
    "recruiter",
    "designer",
    "marketing",
    "intern",
    "internship",
    "junior",
    "graduate",
  ],
} as const;
