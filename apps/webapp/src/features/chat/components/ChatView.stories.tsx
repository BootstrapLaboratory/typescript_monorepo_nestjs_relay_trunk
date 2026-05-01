import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatView } from "./ChatView";
import { MessageAddFormView } from "./MessageAddFormView";
import { MessageView } from "./MessageView";

const sampleMessages = [
  {
    id: "message-1",
    author: "Ada",
    body: "Presentational components make Storybook feel like a design tool again.",
  },
  {
    id: "message-2",
    author: null,
    body: "Containers can keep the runtime wiring where it belongs.",
  },
  {
    id: "message-3",
    author: "Grace",
    body: "Now every interesting state can be reached without a GraphQL server.",
  },
];

function noop() {
  return undefined;
}

const meta = {
  title: "Features/Chat/ChatView",
  component: ChatView,
  tags: ["autodocs"],
  args: {
    messageItems: (
      <MessageView
        author="Ada"
        body="Presentational components make Storybook feel like a design tool again."
      />
    ),
    composer: (
      <MessageAddFormView
        authorValue=""
        bodyValue="A new message"
        isAuthorLocked={false}
        isSubmitting={false}
        onAuthorChange={noop}
        onBodyChange={noop}
        onSubmit={noop}
      />
    ),
    realtimeConnectionMessage: "Connected to server",
  },
} satisfies Meta<typeof ChatView>;

export default meta;

type Story = StoryObj<typeof meta>;

function ComposerFixture({
  recovering = false,
  error = null,
}: {
  recovering?: boolean;
  error?: string | null;
}) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("A new message");

  return (
    <MessageAddFormView
      authorValue={author}
      bodyValue={body}
      isAuthorLocked={false}
      isSubmitting={false}
      disableBecauseLiveUpdatesAreRecovering={recovering}
      liveUpdatesUnavailableMessage={
        recovering ? "Reconnecting live updates..." : null
      }
      submitError={error}
      onAuthorChange={setAuthor}
      onBodyChange={setBody}
      onSubmit={() => undefined}
    />
  );
}

function MessageListFixture() {
  return (
    <>
      {sampleMessages.map((message) => (
        <MessageView
          key={message.id}
          author={message.author}
          body={message.body}
        />
      ))}
    </>
  );
}

export const Connected: Story = {
  render: () => (
    <ChatView
      realtimeConnectionMessage="Connected to server"
      messageItems={<MessageListFixture />}
      composer={<ComposerFixture />}
    />
  ),
};

export const Reconnecting: Story = {
  render: () => (
    <ChatView
      realtimeConnectionMessage="Reconnecting live updates..."
      realtimeConnectionTone="warning"
      messageItems={<MessageListFixture />}
      composer={<ComposerFixture recovering />}
    />
  ),
};

export const Disconnected: Story = {
  render: () => (
    <ChatView
      realtimeConnectionMessage="Live updates disconnected. The connection was closed."
      realtimeConnectionTone="danger"
      messageItems={<MessageListFixture />}
      composer={<ComposerFixture recovering />}
    />
  ),
};
