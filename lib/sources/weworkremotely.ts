import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { decodeEntities, getText, stripHtml } from "./util";

const FEEDS = ["https://weworkremotely.com/remote-jobs.rss"];

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return null;
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
};

export async function fetchWeWorkRemotely(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  const seen = new Set<string>();

  for (const feed of FEEDS) {
    const xml = await getText(feed);
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const item = m[1];
      const link = tag(item, "link");
      const rawTitle = decodeEntities(tag(item, "title"));
      if (!link || !rawTitle || seen.has(link)) continue;
      seen.add(link);

      // Titles read "Company: Job title".
      const idx = rawTitle.indexOf(":");
      const company = idx > 0 ? decodeEntities(rawTitle.slice(0, idx)) : "Unknown";
      const title = idx > 0 ? decodeEntities(rawTitle.slice(idx + 1)) : rawTitle;
      const region = tag(item, "region") ?? tag(item, "category") ?? "";

      out.push({
        source: "weworkremotely",
        external_id: link.split("/").pop() ?? link,
        url: link,
        company,
        title,
        location: region || "Remote",
        remote_scope: inferScope(region || "remote"),
        tags: [],
        description: stripHtml(tag(item, "description")),
        posted_at: tag(item, "pubDate"),
        employment: "full-time",
      });
    }
  }
  return out;
}
