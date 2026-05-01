import type { Meta, StoryObj } from "@storybook/react-vite";
import ProjectInfoPage from "./ProjectInfoPage";

const meta = {
  title: "Features/Project Info/ProjectInfoPage",
  component: ProjectInfoPage,
  tags: ["autodocs"],
} satisfies Meta<typeof ProjectInfoPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
