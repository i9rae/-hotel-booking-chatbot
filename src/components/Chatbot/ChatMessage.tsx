import { ChatMessage as ChatMessageType, SuggestedRoom } from "../../context/ChatContext";

type ChatMessageProps = ChatMessageType & {
  onViewRoom?: (room: SuggestedRoom) => void;
};

export default function ChatMessage({ role, content, suggestedRoom, onViewRoom }: ChatMessageProps) {
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
        {suggestedRoom && onViewRoom && (
          <button
            type="button"
            onClick={() => onViewRoom(suggestedRoom)}
            className="mt-2 block w-full rounded-full bg-primary text-white text-xs font-medium py-1.5 px-3 hover:opacity-90"
          >
            Voir la {suggestedRoom.name}
          </button>
        )}
      </div>
    </div>
  );
}
