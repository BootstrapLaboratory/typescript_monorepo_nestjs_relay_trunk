import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  MessageAddFormView,
  type MessageAddFormViewProps,
} from "./MessageAddFormView";

type MessageAddFormFixtureProps = Pick<
  MessageAddFormViewProps,
  | "isAuthorLocked"
  | "isSubmitting"
  | "disableBecauseLiveUpdatesAreRecovering"
  | "liveUpdatesUnavailableMessage"
  | "submitError"
>;

function noop() {
  return undefined;
}

const meta = {
  title: "Features/Chat/MessageAddFormView",
  component: MessageAddFormView,
  tags: ["autodocs"],
  args: {
    authorValue: "",
    bodyValue: "Hello from Storybook",
    isAuthorLocked: false,
    isSubmitting: false,
    disableBecauseLiveUpdatesAreRecovering: false,
    liveUpdatesUnavailableMessage: null,
    submitError: null,
    onAuthorChange: noop,
    onBodyChange: noop,
    onSubmit: noop,
  },
} satisfies Meta<typeof MessageAddFormView>;

export default meta;

type Story = StoryObj<typeof meta>;

function MessageAddFormFixture({
  isAuthorLocked = false,
  isSubmitting = false,
  disableBecauseLiveUpdatesAreRecovering = false,
  liveUpdatesUnavailableMessage = null,
  submitError = null,
}: Partial<MessageAddFormFixtureProps>) {
  const [author, setAuthor] = useState(isAuthorLocked ? "Ada" : "");
  const [body, setBody] = useState("Hello from Storybook");

  return (
    <MessageAddFormView
      authorValue={author}
      bodyValue={body}
      isAuthorLocked={isAuthorLocked}
      isSubmitting={isSubmitting}
      disableBecauseLiveUpdatesAreRecovering={
        disableBecauseLiveUpdatesAreRecovering
      }
      liveUpdatesUnavailableMessage={liveUpdatesUnavailableMessage}
      submitError={submitError}
      onAuthorChange={setAuthor}
      onBodyChange={setBody}
      onSubmit={() => undefined}
    />
  );
}

export const AnonymousAuthor: Story = {
  args: {
    isAuthorLocked: false,
    isSubmitting: false,
    disableBecauseLiveUpdatesAreRecovering: false,
    liveUpdatesUnavailableMessage: null,
    submitError: null,
  },
  render: (args) => <MessageAddFormFixture {...args} />,
};

export const AuthenticatedAuthor: Story = {
  args: {
    isAuthorLocked: true,
    isSubmitting: false,
    disableBecauseLiveUpdatesAreRecovering: false,
    liveUpdatesUnavailableMessage: null,
    submitError: null,
  },
  render: (args) => <MessageAddFormFixture {...args} />,
};

export const LiveUpdatesRecovering: Story = {
  args: {
    isAuthorLocked: false,
    isSubmitting: false,
    disableBecauseLiveUpdatesAreRecovering: true,
    liveUpdatesUnavailableMessage: "Reconnecting live updates...",
    submitError: null,
  },
  render: (args) => <MessageAddFormFixture {...args} />,
};

export const WithSubmitError: Story = {
  args: {
    isAuthorLocked: false,
    isSubmitting: false,
    disableBecauseLiveUpdatesAreRecovering: false,
    liveUpdatesUnavailableMessage: null,
    submitError: "The server rejected the message.",
  },
  render: (args) => <MessageAddFormFixture {...args} />,
};
