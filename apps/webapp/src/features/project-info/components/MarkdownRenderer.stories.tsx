import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownRenderer } from "./MarkdownRenderer";

const sampleMarkdown = `# Project Notes

This renderer supports **GitHub-flavored markdown**, links, lists, and code.

- Links to repository files are rewritten to GitHub blob URLs.
- External links are kept as-is.

\`\`\`ts
const message = "Rendered in Storybook";
\`\`\`
`;

const meta = {
  title: "Features/Project Info/MarkdownRenderer",
  component: MarkdownRenderer,
  tags: ["autodocs"],
  args: {
    markdown: sampleMarkdown,
  },
} satisfies Meta<typeof MarkdownRenderer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
