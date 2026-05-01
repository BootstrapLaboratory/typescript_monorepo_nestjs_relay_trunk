import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SelectField, type SelectFieldOption } from "./SelectField";

type ThemeChoice = "light" | "dark" | "system";

const options: ReadonlyArray<SelectFieldOption<ThemeChoice>> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function noop() {
  return undefined;
}

const meta = {
  title: "UI/SelectField",
  component: SelectField,
  tags: ["autodocs"],
  args: {
    ariaLabel: "Theme",
    value: "light",
    options,
    onValueChange: noop,
  },
} satisfies Meta<typeof SelectField>;

export default meta;

type Story = StoryObj<typeof meta>;

function SelectFieldExample() {
  const [value, setValue] = useState<ThemeChoice>("light");

  return (
    <SelectField
      ariaLabel="Theme"
      value={value}
      options={options}
      onValueChange={setValue}
    />
  );
}

export const Default: Story = {
  render: () => <SelectFieldExample />,
};
