import { Card } from "@shared/schema";
import { useState } from "react";
import { Button } from "./ui/button";
import VirtualCard from "./virtual-card";

export default function CardCarousel({ cards }: { cards: Card[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  if (!cards.length) return null;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="overflow-hidden">
        <div className="relative">
          <VirtualCard card={cards[currentIndex]} />
        </div>
      </div>
      {cards.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto"
            onClick={prevCard}
          >
            ←
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto"
            onClick={nextCard}
          >
            →
          </Button>
        </div>
      )}
    </div>
  );
}