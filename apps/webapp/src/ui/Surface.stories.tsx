import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Surface } from "./Surface";

const meta = {
  title: "UI/Surface",
  component: Surface,
  tags: ["autodocs"],
} satisfies Meta<typeof Surface>;

export default meta;

type Story = StoryObj<typeof meta>;

const panelStyle = {
  display: "grid",
  gap: "0.5rem",
  maxWidth: "22rem",
  padding: "1.25rem",
} satisfies CSSProperties;

export const Default: Story = {
  render: () => (
    <Surface style={panelStyle}>
      <strong>Default surface</strong>
      <span>Used for regular framed UI content.</span>
    </Surface>
  ),
};

export const Muted: Story = {
  render: () => (
    <Surface tone="muted" style={panelStyle}>
      <strong>Muted surface</strong>
      <span>Used for subdued panels and status states.</span>
    </Surface>
  ),
};

export const Raised: Story = {
  render: () => (
    <Surface tone="raised" style={panelStyle}>
      <strong>Raised surface</strong>
      <span>Used when a panel needs stronger visual separation.</span>
    </Surface>
  ),
};
