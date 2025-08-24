import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playSoundIfEnabled } from "@/lib/sound-service";
import { useToast } from "@/hooks/use-toast";

interface ExchangeDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  amount: string;
  setAmount: (amount: string) => void;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => void;
  toCard: any;
  setToCard: (card: any) => void;
}

export function ExchangeDialog({ 
  open, 
  setOpen, 
  amount, 
  setAmount, 
  currencySymbol, 
  setCurrencySymbol, 
  toCard, 
  setToCard 
}: ExchangeDialogProps) {
  const { toast } = useToast();

  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Exchange logic here
      playSoundIfEnabled('transfer');
      toast({
        title: "Обмен выполнен",
        description: `${amount} ${currencySymbol} успешно обменено`,
      });
      setOpen(false);
    } catch (error) {
      playSoundIfEnabled('error');
      toast({
        title: "Ошибка обмена",
        description: "Попробуйте еще раз",
        variant: "destructive"
      });
    }
  };

  return (
    <div>
      {/* Exchange dialog content */}
      <Button onClick={handleExchange}>
        Выполнить обмен
      </Button>
    </div>
  );
}

export default ExchangeDialog;
