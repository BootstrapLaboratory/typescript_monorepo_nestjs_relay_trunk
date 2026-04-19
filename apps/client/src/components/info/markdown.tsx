import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PROJECT_REPOSITORY_URL = "https://github.com/BeltOrg/beltapp";
const PROJECT_REPOSITORY_BLOB_URL = `${PROJECT_REPOSITORY_URL}/blob/main`;

function normalizeLinkTarget(href: string): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  return `${PROJECT_REPOSITORY_BLOB_URL}/${href.replace(/^\.?\//, "")}`;
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            const target = normalizeLinkTarget(href ?? "");

            return (
              <a
                {...props}
                href={target}
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
      <p className="markdown-footer">
        Source document:{" "}
        <a
          href={`${PROJECT_REPOSITORY_BLOB_URL}/README.md`}
          target="_blank"
          rel="noreferrer"
        >
          README.md on GitHub
        </a>
      </p>
    </div>
  );
}
