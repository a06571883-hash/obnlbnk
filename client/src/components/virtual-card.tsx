import { Card as CardType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";

export default function VirtualCard({ card }: { card: CardType }) {
  const [manualRotateX, setManualRotateX] = useState(0);
  const [manualRotateY, setManualRotateY] = useState(0);
  const gyroscope = useGyroscope();

  const cardColors = {
    crypto: "bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500",
    usd: "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500",
    uah: "bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500",
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 10;
    const rotateY = -(x - centerX) / 10;

    setManualRotateX(rotateX);
    setManualRotateY(rotateY);
  };

  const handleMouseLeave = () => {
    setManualRotateX(0);
    setManualRotateY(0);
  };

  // Combine manual rotation with gyroscope
  const rotateX = manualRotateX || gyroscope.beta;
  const rotateY = manualRotateY || gyroscope.gamma;

  return (
    <motion.div
      className="perspective-1000"
      animate={{
        rotateX,
        rotateY,
        transition: { type: "spring", stiffness: 300, damping: 30 }
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Card className={`w-full h-[220px] ${cardColors[card.type as keyof typeof cardColors]} shadow-xl backdrop-blur-sm`}>
        <CardContent className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
          {/* Фоновые элементы */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full filter blur-xl transform -translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full filter blur-xl transform translate-x-16 translate-y-16" />
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-white/80 text-sm mb-1">Balance</p>
              <p className="text-white text-xl font-bold tracking-wider">
                {card.type === 'crypto' ? 'BTC/ETH' : card.type === 'usd' ? '$' : '₴'}
                {card.balance.toString()}
              </p>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                  {card.type === 'crypto' ? <Wallet className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Card Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Card Number</p>
                    <p className="font-mono">{card.number}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Expiry</p>
                      <p>{card.expiry}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CVV</p>
                      <p>{card.cvv}</p>
                    </div>
                  </div>
                  {card.type === 'crypto' && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">BTC Address</p>
                        <p className="font-mono text-sm break-all">{card.btcAddress}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">ETH Address</p>
                        <p className="font-mono text-sm break-all">{card.ethAddress}</p>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col space-y-4 relative z-10">
            <div className="flex space-x-2">
              <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20">
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Deposit
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20">
                <ArrowDownCircle className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20">
                <RefreshCw className="h-4 w-4 mr-2" />
                Transfer
              </Button>
            </div>

            <div>
              <p className="font-mono text-white/90 text-sm">
                •••• {card.number.slice(-4)}
              </p>
              <p className="text-xs uppercase text-white/80">
                {card.type === 'crypto' ? 'Crypto Card' : card.type === 'usd' ? 'USD Card' : 'UAH Card'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}