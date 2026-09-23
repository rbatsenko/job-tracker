import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} · ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STAGES = ["Shortlist", "Applied", "Interviewing", "Offer"];

// Google Fonts serves TTF to clients that don't ask for woff2, which is what ImageResponse can read.
async function figtree(weight: number) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Figtree:wght@${weight}`).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error("Figtree font not found");
  return fetch(url).then((r) => r.arrayBuffer());
}

export default async function OpengraphImage() {
  const [regular, bold] = await Promise.all([figtree(500), figtree(700)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#14161a",
          color: "#eceef1",
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#1f6f4a",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 8,
              paddingLeft: 20,
            }}
          >
            {[50, 38, 24].map((w, i) => (
              <div key={w} style={{ width: w, height: 11, borderRadius: 6, background: "#fff", opacity: 1 - i * 0.18 }} />
            ))}
          </div>
          <div style={{ fontSize: 56, fontWeight: 700 }}>{SITE.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            Track the jobs you're applying to.
          </div>
          <div style={{ fontSize: 34, color: "#a8b0bb", maxWidth: 950 }}>
            Find remote roles that aren't US-only. Free, no sign-up.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {STAGES.map((s, i) => (
              <div
                key={s}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  fontSize: 24,
                  background: i === 2 ? "#4ade80" : "#23262c",
                  color: i === 2 ? "#0b1f14" : "#a8b0bb",
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 28, color: "#767e8a" }}>jobshelf.app</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: regular, weight: 500, style: "normal" },
        { name: "Figtree", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
