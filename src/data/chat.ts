/**
 * City chat. In the product this is a Supabase Realtime channel per city
 * (`chat:{city}`); here it is a short seeded transcript so the tab shows what
 * the room is actually for.
 */

export type ChatMessage = {
  id: string;
  citySlug: string;
  handle: string;
  initials: string;
  campus: string;
  minutesAgo: number;
  text: string;
};

export const cityChat: readonly ChatMessage[] = [
  {
    id: "c1",
    citySlug: "madrid",
    handle: "aya.m",
    initials: "AM",
    campus: "Complutense",
    minutesAgo: 14,
    text: "anyone been to the rooftop thing tonight? is it actually free before 22",
  },
  {
    id: "c2",
    citySlug: "madrid",
    handle: "seb.a",
    initials: "SA",
    campus: "Carlos III",
    minutesAgo: 12,
    text: "yes went last week, free entry, drinks were €5 though so eat first",
  },
  {
    id: "c3",
    citySlug: "madrid",
    handle: "lucia.r",
    initials: "LR",
    campus: "Complutense",
    minutesAgo: 11,
    text: "the ramen place two streets down does the €8.50 bowl until 23:00",
  },
  {
    id: "c4",
    citySlug: "madrid",
    handle: "yuki.t",
    initials: "YT",
    campus: "Complutense",
    minutesAgo: 8,
    text: "ok going. anyone else around Malasaña at 21",
  },
  {
    id: "c5",
    citySlug: "madrid",
    handle: "hakim.b",
    initials: "HB",
    campus: "Politécnica",
    minutesAgo: 6,
    text: "me. I'll be at the metro at 20:50",
  },
  {
    id: "c6",
    citySlug: "barcelona",
    handle: "pau.v",
    initials: "PV",
    campus: "UB",
    minutesAgo: 9,
    text: "does anyone know a menú in Gràcia open after 15:00",
  },
  {
    id: "c7",
    citySlug: "barcelona",
    handle: "ines.c",
    initials: "IC",
    campus: "Pompeu Fabra",
    minutesAgo: 7,
    text: "the one by the square does it until 16:00 on weekdays",
  },
];

export function chatForCity(citySlug: string): ChatMessage[] {
  return cityChat
    .filter((message) => message.citySlug === citySlug)
    .sort((a, b) => b.minutesAgo - a.minutesAgo);
}
