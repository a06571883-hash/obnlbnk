import { Card } from "@shared/schema";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import VirtualCard from "./virtual-card";

export default function CardCarousel({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {cards.map((card, index) => (
            <CarouselItem key={card.id}>
              <VirtualCard card={card} />
            </CarouselItem>
          ))}
        </CarouselContent>
        {cards.length > 1 && (
          <>
            <CarouselPrevious className="left-2 sm:left-4" />
            <CarouselNext className="right-2 sm:right-4" />
          </>
        )}
      </Carousel>
    </div>
  );
}
