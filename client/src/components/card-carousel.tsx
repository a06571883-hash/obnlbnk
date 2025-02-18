import { useState } from "react";
import { Card as CardType } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import VirtualCard from "./virtual-card";

export default function CardCarousel({ cards }: { cards: CardType[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentCard = cards[currentIndex];

  const handleDragEnd = (e: any, { offset, velocity }: any) => {
    const swipe = Math.abs(offset.x) * velocity.x;

    if (swipe < -50 && currentIndex < cards.length - 1) {
      setCurrentIndex(i => i + 1);
    } else if (swipe > 50 && currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  return (
    <div className="relative overflow-hidden h-[240px]">
      <AnimatePresence initial={false}>
        <motion.div
          key={currentIndex}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute w-full"
        >
          <VirtualCard card={currentCard} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {cards.map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              index === currentIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
