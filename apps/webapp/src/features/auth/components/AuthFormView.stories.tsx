import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthFormView, type AuthFormViewProps } from "./AuthFormView";

type AuthFormFixtureProps = Pick<
  AuthFormViewProps,
  "mode" | "isSubmitting" | "submitError"
>;

function noop() {
  return undefined;
}

const meta = {
  title: "Features/Auth/AuthFormView",
  component: AuthFormView,
  tags: ["autodocs"],
  args: {
    mode: "login",
    email: "reader@example.com",
    displayName: "Reader",
    password: "password123",
    isSubmitting: false,
    submitError: null,
    onEmailChange: noop,
    onDisplayNameChange: noop,
    onPasswordChange: noop,
    onSubmit: noop,
  },
  argTypes: {
    mode: {
      control: "inline-radio",
      options: ["login", "register"],
    },
  },
} satisfies Meta<typeof AuthFormView>;

export default meta;

type Story = StoryObj<typeof meta>;

function AuthFormFixture({
  mode = "login",
  isSubmitting = false,
  submitError = null,
}: Partial<AuthFormFixtureProps>) {
  const [email, setEmail] = useState("reader@example.com");
  const [displayName, setDisplayName] = useState("Reader");
  const [password, setPassword] = useState("password123");

  return (
    <AuthFormView
      mode={mode}
      email={email}
      displayName={displayName}
      password={password}
      isSubmitting={isSubmitting}
      submitError={submitError}
      onEmailChange={setEmail}
      onDisplayNameChange={setDisplayName}
      onPasswordChange={setPassword}
      onSubmit={() => undefined}
    />
  );
}

export const Login: Story = {
  args: {
    mode: "login",
    isSubmitting: false,
    submitError: null,
  },
  render: (args) => <AuthFormFixture {...args} />,
};

export const Register: Story = {
  args: {
    mode: "register",
    isSubmitting: false,
    submitError: null,
  },
  render: (args) => <AuthFormFixture {...args} />,
};

export const WithError: Story = {
  args: {
    mode: "login",
    isSubmitting: false,
    submitError: "Email or password is incorrect.",
  },
  render: (args) => <AuthFormFixture {...args} />,
};

export const Submitting: Story = {
  args: {
    mode: "register",
    isSubmitting: true,
    submitError: null,
  },
  render: (args) => <AuthFormFixture {...args} />,
};
