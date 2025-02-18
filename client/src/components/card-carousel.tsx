import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const navigateCards = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    } else if (direction === 'next' && currentIndex < cards.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  return (
    <div className="relative overflow-hidden h-[280px] w-full max-w-md mx-auto">
      {/* Navigation buttons */}
      <div className="absolute top-1/2 left-4 z-10 transform -translate-y-1/2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/50 backdrop-blur-sm"
          onClick={() => navigateCards('prev')}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute top-1/2 right-4 z-10 transform -translate-y-1/2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/50 backdrop-blur-sm"
          onClick={() => navigateCards('next')}
          disabled={currentIndex === cards.length - 1}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Cards */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentIndex}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
          className="absolute w-full px-4"
        >
          <VirtualCard card={currentCard} />
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? "bg-primary w-4" 
                : "bg-muted hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}