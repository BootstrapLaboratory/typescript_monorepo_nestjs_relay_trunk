import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AuthFormView } from "../components/AuthFormView";
import type { AuthMode } from "../auth-mode";
import { AuthPageView } from "./AuthPageView";

function noop() {
  return undefined;
}

const meta = {
  title: "Features/Auth/AuthPageView",
  component: AuthPageView,
  tags: ["autodocs"],
  args: {
    mode: "login",
    form: (
      <AuthFormView
        mode="login"
        email="reader@example.com"
        displayName="Reader"
        password="password123"
        isSubmitting={false}
        submitError={null}
        onEmailChange={noop}
        onDisplayNameChange={noop}
        onPasswordChange={noop}
        onSubmit={noop}
      />
    ),
    onModeChange: noop,
  },
} satisfies Meta<typeof AuthPageView>;

export default meta;

type Story = StoryObj<typeof meta>;

function AuthPageFixture({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("reader@example.com");
  const [displayName, setDisplayName] = useState("Reader");
  const [password, setPassword] = useState("password123");

  return (
    <AuthPageView
      mode={mode}
      onModeChange={setMode}
      form={
        <AuthFormView
          mode={mode}
          email={email}
          displayName={displayName}
          password={password}
          isSubmitting={false}
          submitError={null}
          onEmailChange={setEmail}
          onDisplayNameChange={setDisplayName}
          onPasswordChange={setPassword}
          onSubmit={() => undefined}
        />
      }
    />
  );
}

export const Login: Story = {
  render: () => <AuthPageFixture initialMode="login" />,
};

export const Register: Story = {
  render: () => <AuthPageFixture initialMode="register" />,
};
