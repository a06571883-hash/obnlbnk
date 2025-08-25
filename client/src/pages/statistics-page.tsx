
import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import TelegramBackground from "../components/telegram-background";
import AnimatedBackground from "../components/animated-background";
import { useAuth } from "../hooks/use-auth";
import { Transaction } from "../../../shared/schema";
import { LineChart, BarChart, PieChart } from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function StatisticsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('bar');

  // Загружаем транзакции
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    enabled: !!user,
  });

  // Фильтруем транзакции за выбранный период
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfPeriod = new Date();
    
    if (period === 'day') {
      startOfPeriod.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      const day = now.getDay() || 7;
      startOfPeriod.setDate(now.getDate() - day + 1);
      startOfPeriod.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startOfPeriod.setDate(1);
      startOfPeriod.setHours(0, 0, 0, 0);
    }
    
    return transactions.filter(tx => new Date(tx.createdAt) >= startOfPeriod);
  }, [transactions, period]);

  // Подсчитываем общие суммы
  const stats = useMemo(() => {
    const incoming = filteredTransactions
      .filter(tx => tx.type === 'transfer' && tx.toCardNumber !== 'REGULATOR')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const outgoing = filteredTransactions
      .filter(tx => tx.type === 'transfer' && tx.fromCardNumber !== 'REGULATOR')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const commission = filteredTransactions
      .filter(tx => tx.type === 'commission')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    return { incoming, outgoing, commission };
  }, [filteredTransactions]);

  // Группируем транзакции по картам
  const cardStats = useMemo(() => {
    const byCard: Record<string, { in: number, out: number }> = {};

    filteredTransactions.forEach(tx => {
      if (tx.type !== 'transfer') return;
      
      // Для входящих транзакций
      if (tx.toCardNumber && tx.toCardNumber !== 'REGULATOR') {
        if (!byCard[tx.toCardNumber]) {
          byCard[tx.toCardNumber] = { in: 0, out: 0 };
        }
        byCard[tx.toCardNumber].in += parseFloat(tx.amount);
      }
      
      // Для исходящих транзакций
      if (tx.fromCardNumber && tx.fromCardNumber !== 'REGULATOR') {
        if (!byCard[tx.fromCardNumber]) {
          byCard[tx.fromCardNumber] = { in: 0, out: 0 };
        }
        byCard[tx.fromCardNumber].out += parseFloat(tx.amount);
      }
    });

    return Object.entries(byCard).map(([card, amounts]) => ({
      card: formatCardNumber(card),
      in: amounts.in.toFixed(2),
      out: amounts.out.toFixed(2),
      balance: (amounts.in - amounts.out).toFixed(2)
    }));
  }, [filteredTransactions]);

  // Функция форматирования номера карты
  const formatCardNumber = (cardNumber: string) => {
    if (cardNumber === 'REGULATOR') return 'Системная карта';
    return `${cardNumber.slice(0, 4)} **** ${cardNumber.slice(-4)}`;
  };

  // Определяем заголовок периода
  const periodTitle = useMemo(() => {
    switch (period) {
      case 'day': return 'сегодня';
      case 'week': return 'за неделю';
      case 'month': return 'за месяц';
      default: return '';
    }
  }, [period]);

  // Функция отображения карточки со статистикой
  const renderChartCard = (title: string, value: number, type: 'income' | 'expense' | 'commission') => {
    const colorClass = type === 'income' 
      ? 'bg-gradient-to-br from-green-500/20 to-green-600/30' 
      : type === 'expense' 
        ? 'bg-gradient-to-br from-red-500/20 to-red-600/30'
        : 'bg-gradient-to-br from-orange-500/20 to-orange-600/30';

    return (
      <Card className={`p-4 ${colorClass}`}>
        <h3 className="font-medium text-sm opacity-80">{title}</h3>
        <div className="text-2xl font-bold mt-2">
          {value.toFixed(2)}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TelegramBackground />
      <AnimatedBackground />
      
      <div className="bg-primary text-primary-foreground p-4 relative">
        <h1 className="text-xl font-bold mb-1">Статистика</h1>
        <p className="text-sm text-primary-foreground/80">Анализ финансов {periodTitle}</p>
      </div>
      
      <div className="p-3 -mt-4 relative">
        <Card className="backdrop-blur-sm bg-background/80 mb-3">
          <div className="p-3 flex flex-col">
            <h2 className="text-lg font-medium mb-2">Период анализа</h2>
            <Select value={period} onValueChange={(value) => setPeriod(value as any)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">За сегодня</SelectItem>
                <SelectItem value="week">За неделю</SelectItem>
                <SelectItem value="month">За месяц</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          {renderChartCard("Получено", stats.incoming, "income")}
          {renderChartCard("Потрачено", stats.outgoing, "expense")}
          {renderChartCard("Комиссия", stats.commission, "commission")}
        </div>
        
        <Card className="backdrop-blur-sm bg-background/80 mb-3">
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-medium">Детализация по картам</h2>
              <div className="flex space-x-2">
                <button onClick={() => setChartType('bar')} className={`p-1 rounded ${chartType === 'bar' ? 'bg-primary text-primary-foreground' : 'opacity-60'}`}>
                  <BarChart size={18} />
                </button>
                <button onClick={() => setChartType('line')} className={`p-1 rounded ${chartType === 'line' ? 'bg-primary text-primary-foreground' : 'opacity-60'}`}>
                  <LineChart size={18} />
                </button>
                <button onClick={() => setChartType('pie')} className={`p-1 rounded ${chartType === 'pie' ? 'bg-primary text-primary-foreground' : 'opacity-60'}`}>
                  <PieChart size={18} />
                </button>
              </div>
            </div>
            
            <Tabs defaultValue="cards">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cards">По картам</TabsTrigger>
                <TabsTrigger value="transactions">Транзакции</TabsTrigger>
              </TabsList>
              
              <TabsContent value="cards">
                <div className="space-y-3 mt-2">
                  {cardStats.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground">
                      Нет данных для выбранного периода
                    </div>
                  ) : (
                    cardStats.map((stat, index) => (
                      <Card key={index} className="p-3">
                        <h3 className="font-medium">{stat.card}</h3>
                        <div className="grid grid-cols-3 mt-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">Получено</div>
                            <div className="font-medium text-green-500">{stat.in}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Отправлено</div>
                            <div className="font-medium text-red-500">{stat.out}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Баланс</div>
                            <div className={`font-medium ${Number(stat.balance) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {stat.balance}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="transactions">
                <div className="space-y-3 mt-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground">
                      Нет транзакций для выбранного периода
                    </div>
                  ) : (
                    filteredTransactions
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 10)
                      .map((tx, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex justify-between">
                            <div>
                              <div className="font-medium truncate max-w-[200px]">
                                {tx.type === 'transfer' ? 'Перевод' : tx.type === 'commission' ? 'Комиссия' : 'Обмен'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(tx.createdAt), 'dd MMM yyyy, HH:mm', { locale: ru })}
                              </div>
                            </div>
                            <div>
                              <div className={`font-medium text-right ${
                                tx.type === 'commission' 
                                  ? 'text-orange-500' 
                                  : tx.fromCardNumber === 'REGULATOR' 
                                    ? 'text-green-500' 
                                    : 'text-red-500'
                              }`}>
                                {tx.amount}
                              </div>
                              <div className="text-xs text-muted-foreground text-right">
                                {formatCardNumber(tx.fromCardNumber)} → {tx.toCardNumber ? formatCardNumber(tx.toCardNumber) : 'External'}
                              </div>
                            </div>
                          </div>
                        </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </div>
    </div>
  );
}
