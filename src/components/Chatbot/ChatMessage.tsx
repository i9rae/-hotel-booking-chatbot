import { ChatMessage as ChatMessageType } from "../../context/ChatContext";

export default function ChatMessage({ role, content }: ChatMessageType) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
