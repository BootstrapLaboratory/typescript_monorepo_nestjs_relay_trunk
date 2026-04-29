import projectReadme from "../../../../../../README.md?raw";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { Surface } from "../../../ui/Surface";
import * as styles from "./ProjectInfoPage.css";

export default function ProjectInfoPage() {
  return (
    <Surface tone="raised" className={styles.page}>
      <MarkdownRenderer markdown={projectReadme} />
    </Surface>
  );
}
