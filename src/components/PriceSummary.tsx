import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type PriceSummaryProps = {
  legacyId: number; // id numérique de la chambre (room.id, ex: 1 à 8)
  checkIn: Date | null;
  checkOut: Date | null;
  guests: number; // adults + kids
};

type NightPrice = {
  date: string; // YYYY-MM-DD
  price: number | null; // null si pas de prix trouvé pour ce jour
  available: boolean;
};

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Toutes les nuits entre checkIn (inclus) et checkOut (exclu) — comme une
// vraie réservation : check-out le 12 ne facture pas la nuit du 12.
function nightsBetween(checkIn: Date, checkOut: Date): string[] {
  const nights: string[] = [];
  const current = new Date(checkIn);
  while (current < checkOut) {
    nights.push(toIsoDate(current));
    current.setDate(current.getDate() + 1);
  }
  return nights;
}

function priceColumnForGuests(guests: number): string {
  const clamped = Math.min(Math.max(Math.round(guests) || 1, 1), 8);
  return `price_${clamped}`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});

export default function PriceSummary({
  legacyId,
  checkIn,
  checkOut,
  guests,
}: PriceSummaryProps) {
  const [nights, setNights] = useState<NightPrice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pas assez d'infos pour calculer un résumé : on n'affiche rien.
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setNights(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadSummary() {
      const priceColumn = priceColumnForGuests(guests);
      const nightDates = nightsBetween(checkIn as Date, checkOut as Date);
      const startIso = nightDates[0];
      const endIso = nightDates[nightDates.length - 1];

      // 1. Trouve l'id Supabase (uuid) correspondant à ce numéro de chambre.
      const { data: room, error: roomError } = await supabase
        .from("room_types")
        .select("id, total_units")
        .eq("legacy_id", legacyId)
        .single();

      if (roomError || !room) {
        if (!cancelled) {
          setError("Impossible de charger les prix pour cette chambre.");
          setLoading(false);
        }
        return;
      }

      // 2. Prix de chaque nuit de la plage.
      const { data: rates, error: ratesError } = await supabase
        .from("daily_rates")
        .select(`date, ${priceColumn}`)
        .eq("room_type_id", room.id)
        .gte("date", startIso)
        .lte("date", endIso);

      // 3. Réservations existantes qui chevauchent la plage (pour la dispo).
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("start_date, end_date")
        .eq("room_type_id", room.id)
        .eq("status", "confirmed")
        .lt("start_date", endIso)
        .gt("end_date", startIso);

      if (cancelled) return;

      if (ratesError || bookingsError || !rates) {
        setError("Impossible de charger les prix pour cette chambre.");
        setLoading(false);
        return;
      }

      const ratesByDate = new Map<string, number | null>();
      for (const row of rates as unknown as Record<string, string | number | null>[]) {
        ratesByDate.set(row.date as string, row[priceColumn] as number | null);
      }

      const result: NightPrice[] = nightDates.map((isoDate) => {
        const price = ratesByDate.get(isoDate) ?? null;
        const bookedUnits = (bookings ?? []).filter(
          (b) => isoDate >= b.start_date && isoDate < b.end_date
        ).length;
        const available = room.total_units - bookedUnits > 0;
        return { date: isoDate, price, available };
      });

      setNights(result);
      setLoading(false);
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [legacyId, checkIn, checkOut, guests]);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return (
      <p className="text-sm text-gray-500 mt-4">
        Choisissez une date de check-in et de check-out pour voir le prix total.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-gray-500 mt-4">Calcul du prix en cours…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 mt-4">{error}</p>;
  }

  if (!nights || nights.length === 0) return null;

  const allAvailable = nights.every((n) => n.available && n.price !== null);
  const total = nights.reduce((sum, n) => sum + (n.price ?? 0), 0);

  return (
    <div className="mt-6 border-t pt-4">
      <h4 className="text-sm font-semibold mb-2">Détail du prix</h4>
      <ul className="text-sm space-y-1 mb-3">
        {nights.map((n) => (
          <li key={n.date} className="flex justify-between">
            <span className={!n.available || n.price === null ? "text-red-500" : ""}>
              {dateFormatter.format(new Date(n.date + "T00:00:00Z"))}
              {!n.available && " — indisponible"}
              {n.available && n.price === null && " — prix non défini"}
            </span>
            <span>{n.price !== null ? `${n.price} €` : "—"}</span>
          </li>
        ))}
      </ul>
      {allAvailable ? (
        <div className="flex justify-between font-semibold text-base border-t pt-2">
          <span>Total ({nights.length} nuit{nights.length > 1 ? "s" : ""})</span>
          <span>{total} €</span>
        </div>
      ) : (
        <p className="text-sm text-red-600 font-medium">
          Cette période n'est pas entièrement disponible pour cette chambre.
        </p>
      )}
    </div>
  );
}
