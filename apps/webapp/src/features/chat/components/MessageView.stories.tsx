import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageView } from "./MessageView";

const meta = {
  title: "Features/Chat/MessageView",
  component: MessageView,
  tags: ["autodocs"],
  args: {
    author: "Ada",
    body: "The UI layer is much easier to reason about once data dependencies are outside the view.",
  },
} satisfies Meta<typeof MessageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Authored: Story = {};

export const Anonymous: Story = {
  args: {
    author: null,
    body: "This message uses the anonymous fallback label.",
  },
};
