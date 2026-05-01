import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextField } from "./TextField";

const meta = {
  title: "UI/TextField",
  component: TextField,
  tags: ["autodocs"],
  args: {
    placeholder: "name@example.com",
  },
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithValue: Story = {
  args: {
    defaultValue: "reader@example.com",
  },
};

export const Password: Story = {
  args: {
    type: "password",
    defaultValue: "correct horse battery staple",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Locked value",
  },
};
