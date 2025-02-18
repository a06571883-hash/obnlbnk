import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useGyroscope } from "@/hooks/use-gyroscope";
import { useMutation as useReactMutation, useQueryClient } from "@tanstack/react-query";

const useMutation = useReactMutation;

const cardColors = {
  crypto: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  usd: "bg-gradient-to-br from-green-400 to-green-600",
  uah: "bg-gradient-to-br from-blue-400 to-blue-600",
};

export default function VirtualCard({ card }: { card: any }) {
  const [manualRotateX, setManualRotateX] = useState(0);
  const [manualRotateY, setManualRotateY] = useState(0);
  const gyroscope = useGyroscope();
  const queryClient = useQueryClient();

  const updateBalanceMutation = useMutation({
    mutationFn: () => {
      return fetch('/api/cards/update-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update balance');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
    }
  });

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientCardNumber, setRecipientCardNumber] = useState('');
  const [transferError, setTransferError] = useState('');

  const transferMutation = useMutation({
    mutationFn: (data: any) => {
      return fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['card']);
      setIsTransferring(false);
      setTransferAmount('');
      setRecipientCardNumber('');
      setTransferError('');
    },
    onError: (error: any) => {
      setIsTransferring(false);
      setTransferError(error.message || 'Transfer failed.');
    },
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientY - rect.top) / rect.height;
    const y = (e.clientX - rect.left) / rect.width;

    setManualRotateX((x - 0.5) * 20);
    setManualRotateY((y - 0.5) * 20);
  };

  const handleMouseLeave = () => {
    setManualRotateX(0);
    setManualRotateY(0);
  };

  const rotateX = gyroscope ? -gyroscope.x * 20 : manualRotateX;
  const rotateY = gyroscope ? -gyroscope.y * 20 : manualRotateY;

  const handleTransfer = async () => {
    setIsTransferring(true);
    try {
      await transferMutation.mutateAsync({
        fromCard: card.id,
        toCard: recipientCardNumber,
        amount: transferAmount,
        currency: card.type,
      });
    } catch (error) {
      console.error("Transfer error:", error);
    }
  };

  return (
    <motion.div
      className="perspective-1000"
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: 'transform 0.3s ease-out'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <UICard className={`w-full h-[220px] ${cardColors[card.type]} shadow-xl backdrop-blur-sm`}>
        <CardContent className="p-6 h-full flex flex-col justify-between relative overflow-hidden">
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20">
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Deposit Funds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {card.type === 'crypto' ? (
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
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">Card Number</p>
                        <p className="font-mono">{card.number}</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20">
                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                    Withdraw
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Withdraw Funds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground">
                      Contact support @KA7777AA to process your withdrawal
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="flex-1 text-white hover:bg-white/20" onClick={() => {}}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Transfer Funds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="Amount" />
                    <input type="text" value={recipientCardNumber} onChange={e => setRecipientCardNumber(e.target.value)} placeholder="Recipient Card Number" />
                    {transferError && <p className="text-red-500">{transferError}</p>}
                    <Button onClick={handleTransfer} disabled={isTransferring}>
                      {isTransferring ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : "Transfer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
      </UICard>
    </motion.div>
  );
}