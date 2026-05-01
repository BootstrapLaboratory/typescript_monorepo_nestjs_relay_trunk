import type { Meta, StoryObj } from "@storybook/react-vite";
import { PendingState } from "./StatusState";

const meta = {
  title: "UI/StatusState",
  component: PendingState,
  tags: ["autodocs"],
  args: {
    eyebrow: "Loading chat",
    title: "Connecting to messages",
    message:
      "The route has switched already. Messages will appear as soon as Relay finishes the query.",
  },
} satisfies Meta<typeof PendingState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const CompactMessage: Story = {
  args: {
    eyebrow: "Session",
    title: "Checking session",
    message: "The page is ready while the browser session is restored.",
  },
};
