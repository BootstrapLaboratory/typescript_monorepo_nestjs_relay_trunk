import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../../ui/Button";
import { NotFoundPageView } from "./NotFoundPageView";

const meta = {
  title: "Features/Navigation/NotFoundPageView",
  component: NotFoundPageView,
  tags: ["autodocs"],
  args: {
    returnAction: (
      <Button asChild variant="secondary">
        <a href="#chat">Return to chat</a>
      </Button>
    ),
  },
} satisfies Meta<typeof NotFoundPageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <NotFoundPageView
      returnAction={
        <Button asChild variant="secondary">
          <a href="#chat">Return to chat</a>
        </Button>
      }
    />
  ),
};
