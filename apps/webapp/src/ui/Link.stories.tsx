import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "./Link";

const meta = {
  title: "UI/Link",
  component: Link,
  tags: ["autodocs"],
  args: {
    href: "https://relay.dev/",
    children: "Relay documentation",
  },
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Subtle: Story = {
  args: {
    tone: "subtle",
    children: "Subtle link",
  },
};
