import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatView } from "../components/ChatView";
import { MessageAddFormView } from "../components/MessageAddFormView";
import { MessageView } from "../components/MessageView";
import ChatPage from "./ChatPage";

const messages = [
  {
    id: "page-message-1",
    author: "Ada",
    body: "The page can be designed around a composed chat view.",
  },
  {
    id: "page-message-2",
    author: "Grace",
    body: "No Relay environment needed for this visual state.",
  },
];

const meta = {
  title: "Features/Chat/ChatPage",
  component: ChatPage,
  tags: ["autodocs"],
  args: {
    chat: <ChatFixture />,
  },
} satisfies Meta<typeof ChatPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function ChatFixture() {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("Hello from the page story");

  return (
    <ChatView
      realtimeConnectionMessage="Connected to server"
      messageItems={
        <>
          {messages.map((message) => (
            <MessageView
              key={message.id}
              author={message.author}
              body={message.body}
            />
          ))}
        </>
      }
      composer={
        <MessageAddFormView
          authorValue={author}
          bodyValue={body}
          isAuthorLocked={false}
          isSubmitting={false}
          onAuthorChange={setAuthor}
          onBodyChange={setBody}
          onSubmit={() => undefined}
        />
      }
    />
  );
}

export const Default: Story = {
  render: () => <ChatPage chat={<ChatFixture />} />,
};
