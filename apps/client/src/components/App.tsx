import Chat from "./chat/Chat";
import { Header, ReadTheDocs } from "./info/Info";
import "./App.css";

export default function App() {
  return (
    <>
      <Header />
      <Chat />
      <ReadTheDocs />
    </>
  );
}
