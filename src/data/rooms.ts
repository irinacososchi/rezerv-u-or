import sala1 from "@/assets/sala-1.jpg";
import sala2 from "@/assets/sala-2.jpg";
import sala3 from "@/assets/sala-3.jpg";
import type { Room } from "@/components/room-card";

export const rooms: Room[] = [
  {
    id: "1",
    name: "Studio Lumina",
    neighbourhood: "Floreasca",
    city: "București",
    priceMin: 60,
    priceMax: 90,
    image: sala1,
    hasMirrors: true,
    hasSound: false,
    hasBarre: true,
  },
  {
    id: "2",
    name: "Sala Ritm",
    neighbourhood: "Centru",
    city: "Cluj-Napoca",
    priceMin: 80,
    priceMax: 120,
    image: sala2,
    hasMirrors: true,
    hasSound: true,
    hasBarre: false,
  },
  {
    id: "3",
    name: "Atelier Mișcare",
    neighbourhood: "Iosefin",
    city: "Timișoara",
    priceMin: 50,
    priceMax: 80,
    image: sala3,
    hasMirrors: true,
    hasSound: false,
    hasBarre: true,
  },
];
