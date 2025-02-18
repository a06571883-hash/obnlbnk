import { Card as CardType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet } from "lucide-react";

export default function VirtualCard({ card }: { card: CardType }) {
  const cardColors = {
    crypto: "bg-gradient 'bg-gradient-to-r from-violet-500 to-fuchsia-500'",
    usd: "bg-gradient-to-r from-green-500 to-emerald-500",
    uah: "bg-gradient-to-r from-blue-500 to-cyan-500",
  };

  return (
    <Card className={`w-full h-[200px] text-white ${cardColors[card.type as keyof typeof cardColors]}`}>
      <CardContent className="p-6 h-full flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm opacity-80">Balance</p>
            <p className="text-xl font-bold">
              {card.type === 'crypto' ? 'BTC/ETH' : card.type === 'usd' ? '$' : '₴'}
              {card.balance.toString()}
            </p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                {card.type === 'crypto' ? <Wallet className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </Button>
            </DialogTrigger>
            <DialogContent>
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
        
        <div>
          <p className="font-mono text-sm mb-2">
            •••• {card.number.slice(-4)}
          </p>
          <p className="text-xs uppercase">
            {card.type === 'crypto' ? 'Crypto Card' : card.type === 'usd' ? 'USD Card' : 'UAH Card'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
