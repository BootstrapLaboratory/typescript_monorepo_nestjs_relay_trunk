import projectReadme from "../../../../../README.md?raw";
import { MarkdownRenderer } from "./markdown";

export default function ProjectReadmePage() {
  return (
    <section className="info-page">
      <MarkdownRenderer markdown={projectReadme} />
    </section>
  );
}
