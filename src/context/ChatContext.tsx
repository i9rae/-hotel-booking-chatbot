import { createContext, useContext, useState, ReactNode } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatContextType {
  isOpen: boolean;
  toggleChat: () => void;
  messages: ChatMessage[];
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Bonjour 👋 Dites-moi vos dates flexibles, votre budget et le nombre de personnes, et je trouve la date la moins chère pour vous.",
    },
  ]);
  const [sending, setSending] = useState(false);

  const toggleChat = () => setIsOpen((prev) => !prev);

  const sendMessage = async (text: string) => {
    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: updated.slice(0, -1), // historique sans le dernier message (déjà envoyé à part)
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Désolé, une erreur est survenue.",
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Désolé, je n'arrive pas à répondre pour le moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <ChatContext.Provider value={{ isOpen, toggleChat, messages, sending, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext doit être utilisé dans un ChatProvider");
  }
  return context;
}
