import type { Metadata } from "next";
import Board from "./board";

export const dynamic = "force-dynamic";

// Listings belong to the boards they come from, so keep search engines off the mirror.
export const metadata: Metadata = {
  title: "Find remote jobs",
  description:
    "Remote jobs from Remote OK, Remotive, Himalayas, Jobicy, Arbeitnow and We Work Remotely, in one list, with US-only roles filtered out.",
  alternates: { canonical: "/board" },
  robots: { index: false, follow: true },
};

export default function BoardPage() {
  return <Board />;
}
