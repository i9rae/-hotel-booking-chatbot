// Fonction serverless Vercel — /api/chat
// Variables d'environnement requises (Vercel > Settings > Environment Variables) :
//   GROK_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "./_lib/supabase.js";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = process.env.GROK_MODEL || "grok-3-mini";

interface ChatBody {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const tools = [
  {
    type: "function",
    function: {
      name: "search_cheapest_option",
      description:
        "Cherche, dans le calendrier de prix réel de l'hôtel, la chambre et la date les moins chères sur une plage de dates, selon le budget et le nombre de personnes du client.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Début de la plage de dates flexible, format YYYY-MM-DD",
          },
          end_date: {
            type: "string",
            description: "Fin de la plage de dates flexible, format YYYY-MM-DD",
          },
          max_budget: {
            type: "number",
            description: "Budget maximum par nuit (optionnel)",
          },
          guests: {
            type: "number",
            description: "Nombre total de personnes, adultes + enfants (optionnel)",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
];

async function runSearchCheapestOption(args: {
  start_date: string;
  end_date: string;
  max_budget?: number;
  guests?: number;
}) {
  let query = supabase
    .from("daily_rates")
    .select("date, price, room_types!inner(id, name, max_person)")
    .gte("date", args.start_date)
    .lte("date", args.end_date)
    .order("price", { ascending: true })
    .limit(1);

  if (args.max_budget) {
    query = query.lte("price", args.max_budget);
  }
  if (args.guests) {
    query = query.gte("room_types.max_person", args.guests);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erreur Supabase:", error);
    return { found: false, message: "Erreur lors de la recherche en base." };
  }

  if (!data || data.length === 0) {
    return {
      found: false,
      message: "Aucune chambre disponible ne correspond à ces critères sur cette période.",
    };
  }

  const best = data[0] as unknown as {
    date: string;
    price: number;
    room_types: { id: string; name: string; max_person: number };
  };

  return {
    found: true,
    room_name: best.room_types.name,
    date: best.date,
    price: best.price,
    max_person: best.room_types.max_person,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { message, history = [] } = req.body as ChatBody;

  if (!message) {
    return res.status(400).json({ error: "Message manquant" });
  }

  const systemPrompt = `Tu es l'assistant de réservation de l'hôtel. Tu aides les clients à
trouver la chambre la moins chère selon leurs contraintes (dates flexibles, budget, nombre de
personnes, équipements). Utilise l'outil search_cheapest_option dès que tu as au moins une
plage de dates. Si des informations manquent (dates, nombre de personnes), demande-les avant
d'appeler l'outil. Réponds toujours en français, de façon concise et chaleureuse.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  try {
    const firstResponse = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!firstResponse.ok) {
      const errText = await firstResponse.text();
      throw new Error(`Erreur API Grok: ${errText}`);
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices[0];
    const toolCalls = choice.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return res.status(200).json({ reply: choice.message.content });
    }

    const toolCall = toolCalls[0];
    const args = JSON.parse(toolCall.function.arguments);
    const toolResult = await runSearchCheapestOption(args);

    const secondResponse = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          ...messages,
          choice.message,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ],
      }),
    });

    const secondData = await secondResponse.json();
    const finalReply = secondData.choices[0].message.content;

    return res.status(200).json({ reply: finalReply, toolResult });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur lors du traitement de la demande." });
  }
}
