// Fonction serverless Vercel — /api/chat
// Variables d'environnement requises (Vercel > Settings > Environment Variables) :
//   GROK_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "./_lib/supabase.js";

const GROK_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROK_MODEL = process.env.GROK_MODEL || "openai/gpt-oss-120b";

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
        "Cherche, dans le calendrier de prix réel de l'hôtel, la chambre et la période de séjour (N nuits consécutives) les moins chères au total sur une plage de dates flexible, selon le budget par nuit et le nombre de personnes du client.",
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
          nights: {
            type: "number",
            description:
              "Nombre de nuits du séjour souhaité (optionnel, défaut 1 si non précisé). Le chatbot cherche la fenêtre de N nuits consécutives la moins chère au total dans la plage de dates flexible.",
          },
          keywords: {
            type: "string",
            description:
              "Mots-clés décrivant ce que recherche le client dans l'ambiance ou les caractéristiques de la chambre (ex: 'vue sur mer', 'romantique', 'jacuzzi', 'familiale', 'balcon'). Optionnel — n'utilise ce champ que si le client décrit une ambiance ou une caractéristique précise, pas juste des dates/budget.",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
];


// Renvoie le nom de colonne à interroger dans daily_rates selon le nombre
// de personnes demandé. "price" (colonne de base) sert de valeur par défaut
// quand le client n'a pas précisé de nombre de personnes.
function priceColumnForGuests(guests?: number): string {
  if (!guests) return "price";
  const clamped = Math.min(Math.max(Math.round(guests), 1), 8);
  return `price_${clamped}`;
}


// Nombre de chambres déjà réservées (status confirmed) qui couvrent cette
// date. end_date est exclusive (date de départ), comme une vraie réservation.
function bookedUnitsOnDate(
  bookings: { start_date: string; end_date: string }[],
  isoDate: string
): number {
  return bookings.filter((b) => isoDate >= b.start_date && isoDate < b.end_date).length;
}


function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}


async function runSearchCheapestOption(args: {
  start_date: string;
  end_date: string;
  max_budget?: number;
  guests?: number;
  nights?: number;
  keywords?: string;
}) {
  const priceColumn = priceColumnForGuests(args.guests);
  const nights = Math.max(1, Math.round(args.nights ?? 1));

  // 1. Sélectionne les chambres candidates : assez grandes pour le nombre de
  // personnes, et correspondant aux mots-clés si le client en a donné.
  let roomQuery = supabase
    .from("room_types")
    .select("id, legacy_id, name, description, max_person, total_units");

  if (args.guests) {
    roomQuery = roomQuery.gte("max_person", args.guests);
  }

  if (args.keywords) {
    const words = args.keywords
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2);

    if (words.length > 0) {
      const orFilter = words.map((w) => `description.ilike.%${w}%`).join(",");
      roomQuery = roomQuery.or(orFilter);
    }
  }

  const { data: rooms, error: roomsError } = await roomQuery;

  if (roomsError) {
    console.error("Erreur Supabase (room_types):", roomsError);
    return { found: false, message: "Erreur lors de la recherche en base." };
  }

  if (!rooms || rooms.length === 0) {
    return {
      found: false,
      message: "Aucune chambre ne correspond à ces critères (taille ou description).",
    };
  }

  // La dernière date de début de fenêtre possible : il faut que les `nights`
  // nuits consécutives tiennent avant end_date.
  const lastWindowStart = addDays(args.end_date, -(nights - 1));

  if (lastWindowStart < args.start_date) {
    return {
      found: false,
      message: `La plage de dates est trop courte pour un séjour de ${nights} nuit(s).`,
    };
  }

  // 2. Pour chaque chambre candidate : récupère tous les prix + réservations
  // de la plage, puis cherche la fenêtre de `nights` nuits consécutives dont
  // la somme est la plus basse, en ne gardant que les fenêtres où CHAQUE
  // nuit est disponible (et sous le budget par nuit, si précisé).
  const candidates = await Promise.all(
    rooms.map(async (room) => {
      const [{ data: rates, error: ratesError }, { data: bookings, error: bookingsError }] =
        await Promise.all([
          supabase
            .from("daily_rates")
            .select(`date, ${priceColumn}`)
            .eq("room_type_id", room.id)
            .gte("date", args.start_date)
            .lte("date", args.end_date),
          supabase
            .from("bookings")
            .select("start_date, end_date")
            .eq("room_type_id", room.id)
            .eq("status", "confirmed")
            .lt("start_date", args.end_date)
            .gt("end_date", args.start_date),
        ]);

      if (ratesError || bookingsError || !rates) return null;

      const priceByDate = new Map<string, number>();

      for (const row of rates as unknown as Record<string, string | number | null>[]) {
        const price = row[priceColumn];

        if (typeof price === "number") {
          priceByDate.set(row.date as string, price);
        }
      }

      let best: { start: string; total: number } | null = null;

      for (
        let start = args.start_date;
        start <= lastWindowStart;
        start = addDays(start, 1)
      ) {
        let windowTotal = 0;
        let windowValid = true;

        for (let i = 0; i < nights; i++) {
          const night = addDays(start, i);
          const price = priceByDate.get(night);

          if (price === undefined) {
            windowValid = false;
            break;
          }

          if (args.max_budget && price > args.max_budget) {
            windowValid = false;
            break;
          }

          const bookedUnits = bookedUnitsOnDate(bookings ?? [], night);

          if (room.total_units - bookedUnits <= 0) {
            windowValid = false;
            break;
          }

          windowTotal += price;
        }

        if (windowValid && (!best || windowTotal < best.total)) {
          best = { start, total: windowTotal };
        }
      }

      if (!best) return null;

      return {
        room,
        checkIn: best.start,
        checkOut: addDays(best.start, nights),
        total: best.total,
      };
    })
  );

  const valid = candidates.filter(
    (c): c is NonNullable<typeof c> => c !== null
  );

  if (valid.length === 0) {
    return {
      found: false,
      message:
        "Aucune chambre disponible ne correspond à ces critères sur cette période (soit trop chère, soit déjà complète).",
    };
  }

  const best = valid.sort((a, b) => a.total - b.total)[0];

  return {
    found: true,
    room_id: best.room.legacy_id,
    room_name: best.room.name,
    room_description: best.room.description,
    check_in: best.checkIn,
    check_out: best.checkOut,
    nights,
    total_price: best.total,
    price_per_night: Math.round((best.total / nights) * 100) / 100,
    max_person: best.room.max_person,
    guests: args.guests ?? null,
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
trouver la chambre la moins chère selon leurs contraintes (dates flexibles, nombre de nuits,
budget par nuit, nombre de personnes). Si le client précise une durée de séjour (ex: "3 nuits",
"une semaine"), transmets-la dans le paramètre nights de l'outil — sinon laisse-le vide (défaut:
1 nuit). Si le client décrit une ambiance ou une caractéristique précise (vue sur mer, romantique,
jacuzzi, familiale, balcon...), transmets ces mots-clés dans le paramètre keywords. Utilise l'outil
search_cheapest_option dès que tu as au moins une plage de dates. Si des informations manquent
(dates, nombre de personnes), demande-les avant d'appeler l'outil. Réponds toujours en français,
de façon concise et chaleureuse.`;

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
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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