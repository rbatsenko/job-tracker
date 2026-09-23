import { SITE } from "@/lib/site";

const link = "text-soft underline-offset-4 hover:text-text hover:underline";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-6 text-sm text-faint sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Built by{" "}
          <a href={SITE.author.url} className={link}>
            {SITE.author.name}
          </a>
        </p>
        <p className="flex gap-4">
          <a href={SITE.repo} className={link}>
            Source on GitHub
          </a>
          <a href="/llms.txt" className={link}>
            llms.txt
          </a>
        </p>
      </div>
    </footer>
  );
}
