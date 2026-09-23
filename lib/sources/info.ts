/** Every source here publishes a public API or feed and asks to be named and linked. */
export const SOURCE_INFO: Record<string, { name: string; url: string }> = {
  remoteok: { name: "Remote OK", url: "https://remoteok.com" },
  remotive: { name: "Remotive", url: "https://remotive.com" },
  himalayas: { name: "Himalayas", url: "https://himalayas.app" },
  jobicy: { name: "Jobicy", url: "https://jobicy.com" },
  arbeitnow: { name: "Arbeitnow", url: "https://www.arbeitnow.com" },
  weworkremotely: { name: "We Work Remotely", url: "https://weworkremotely.com" },
};

export const sourceName = (key: string) => SOURCE_INFO[key]?.name ?? key;
