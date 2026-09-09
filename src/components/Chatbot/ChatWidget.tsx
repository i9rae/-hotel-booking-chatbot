import { useState, useRef, useEffect } from "react";
import { BsChatDots, BsX, BsSend } from "react-icons/bs";
import { useChatContext } from "../../context/ChatContext";
import ChatMessage from "./ChatMessage";

export default function ChatWidget() {
  const { isOpen, toggleChat, messages, sending, sendMessage } = useChatContext();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <>
      {/* Bouton flottant — toujours visible, ne modifie pas le reste de l'UI */}
      <button
        onClick={toggleChat}
        aria-label="Ouvrir le chat de réservation"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105"
      >
        {isOpen ? <BsX size={26} /> : <BsChatDots size={22} />}
      </button>

      {/* Panneau de chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[340px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="bg-primary px-4 py-3 text-white">
            <p className="font-heading text-lg">Assistant Réservation</p>
            <p className="text-xs opacity-80">Trouvez la date la moins chère</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {sending && (
              <div className="mb-3 flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-400">
                  …
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: chambre pour 2 en juillet, budget 800/nuit"
              className="flex-1 rounded-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sending}
              aria-label="Envoyer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
            >
              <BsSend size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
