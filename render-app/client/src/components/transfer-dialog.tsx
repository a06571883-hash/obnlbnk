import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { playSoundIfEnabled } from "@/lib/sound-service"
import { toast } from "@/components/ui/toast"


function TransferForm({ open, setOpen, amount, setAmount, currencySymbol, setCurrencySymbol, toCard, setToCard,  }) {

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // ... other code to handle the transfer ...
      playSoundIfEnabled('transfer') 
      toast({
        title: "Перевод выполнен",
        description: `${amount} ${currencySymbol} успешно переведено на карту ${toCard}`,
      })
      setOpen(false)
    } catch (error) {
      playSoundIfEnabled('error') 
      // ... error handling ...
      toast({
        title: "Ошибка перевода",
        description: "Произошла ошибка при переводе средств. Пожалуйста, попробуйте еще раз.",
      })
    }
  }


  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} />
      <Input type="text" placeholder="Валюта" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
      <Input type="text" placeholder="Номер карты получателя" value={toCard} onChange={(e) => setToCard(e.target.value)} />
      <Button type="submit">Перевести</Button> 
    </form>
  )
}

// Example button with sound effect
function MyButton({onClick, children}) {
  return (
    <Button onClick={() => {playSoundIfEnabled('buttonClick'); onClick()}}>
       {children}
    </Button>
  )
}

export default TransferForm;
export {MyButton}