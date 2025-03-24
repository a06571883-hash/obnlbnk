import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Eye, EyeOff, Check, RefreshCw, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface SeedPhraseData {
  seedPhrase: string;
  addresses: {
    btc: string;
    eth: string;
  };
  message?: string;
}

export function SeedPhraseDisplay() {
  const [data, setData] = useState<SeedPhraseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhrase, setShowPhrase] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userSeedPhrase, setUserSeedPhrase] = useState('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    addresses?: { btc: string; eth: string };
    message?: string;
  } | null>(null);
  const [validating, setValidating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSeedPhrase();
  }, []);

  const fetchSeedPhrase = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest('GET', '/api/crypto/seed-phrase');
      const data = await response.json();
      setData(data as SeedPhraseData);
    } catch (err) {
      console.error('Failed to fetch seed phrase:', err);
      setError('Не удалось получить seed-фразу. Пожалуйста, попробуйте позже.');
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось получить seed-фразу",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({
        title: "Скопировано",
        description: "Seed-фраза скопирована в буфер обмена"
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const validateSeedPhrase = async () => {
    if (!userSeedPhrase.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите seed-фразу для проверки",
        variant: "destructive"
      });
      return;
    }

    setValidating(true);
    try {
      const response = await apiRequest('POST', '/api/crypto/verify-seed-phrase', { 
        seedPhrase: userSeedPhrase 
      });
      
      const data = await response.json();
      const typedResponse = data as {
        valid: boolean;
        addresses?: { btc: string; eth: string };
        message?: string;
      };
      
      setValidationResult(typedResponse);
      if (typedResponse.valid) {
        toast({
          title: "Успешно",
          description: "Seed-фраза проверена и действительна"
        });
      } else {
        toast({
          title: "Ошибка",
          description: typedResponse.message || "Невалидная seed-фраза",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Failed to validate seed phrase:', err);
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "Не удалось проверить seed-фразу",
        variant: "destructive"
      });
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-2 max-w-full overflow-hidden text-xs sm:text-sm">
      <Collapsible defaultOpen className="space-y-2 mb-3">
        <CollapsibleTrigger className="flex items-center justify-between w-full bg-primary/5 p-2 rounded">
          <h3 className="font-medium">Ваша Seed-фраза</h3>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Это ваша seed-фраза для восстановления доступа к криптовалютным средствам. 
            Храните её в надёжном месте.
          </p>

          {loading ? (
            <Card className="bg-muted/50">
              <CardContent className="p-2 flex justify-center items-center h-12">
                <RefreshCw className="animate-spin h-4 w-4 text-primary" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-destructive/10">
              <CardContent className="p-2">
                <p className="text-xs text-destructive">{error}</p>
                <Button onClick={fetchSeedPhrase} variant="outline" className="mt-2" size="sm">
                  Повторить
                </Button>
              </CardContent>
            </Card>
          ) : data ? (
            <Card className="bg-muted/50">
              <CardContent className="p-2">
                <div className="flex justify-end mb-2 space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center h-7 px-2 text-xs" 
                    onClick={() => setShowPhrase(!showPhrase)}
                  >
                    {showPhrase ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showPhrase ? "Скрыть" : "Показать"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center h-7 px-2 text-xs" 
                    onClick={() => copyToClipboard(data.seedPhrase)}
                    disabled={!showPhrase || copied}
                  >
                    {copied ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "Скопировано" : "Копировать"}
                  </Button>
                </div>
                
                <div className={`bg-black/5 p-2 rounded-md font-mono text-xs break-all mb-2 ${showPhrase ? '' : 'blur-sm select-none'}`}>
                  {data.seedPhrase}
                </div>
                
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Связанные адреса:</p>
                  <div className="space-y-2">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">BTC</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-5 px-2 flex items-center"
                          onClick={() => {
                            navigator.clipboard.writeText(data.addresses.btc);
                            toast({ title: "Скопировано", description: "Bitcoin-адрес скопирован" });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          <span className="text-xs">Копировать</span>
                        </Button>
                      </div>
                      <div className="bg-black/5 rounded p-1.5 text-xs font-mono break-all">
                        {data.addresses.btc}
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">ETH</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-5 px-2 flex items-center"
                          onClick={() => {
                            navigator.clipboard.writeText(data.addresses.eth);
                            toast({ title: "Скопировано", description: "Ethereum-адрес скопирован" });
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          <span className="text-xs">Копировать</span>
                        </Button>
                      </div>
                      <div className="bg-black/5 rounded p-1.5 text-xs font-mono break-all">
                        {data.addresses.eth}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="space-y-2">
        <CollapsibleTrigger className="flex items-center justify-between w-full bg-primary/5 p-2 rounded">
          <h3 className="font-medium">Проверить seed-фразу</h3>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          <p className="text-xs text-muted-foreground">
            Введите seed-фразу для проверки валидности и получения связанных криптоадресов.
          </p>
          
          <div className="space-y-1">
            <Label htmlFor="seed-phrase" className="text-xs">Введите seed-фразу</Label>
            <Input 
              id="seed-phrase" 
              value={userSeedPhrase}
              onChange={(e) => setUserSeedPhrase(e.target.value)}
              placeholder="Введите 12 слов через пробел"
              className="text-xs py-1 h-8"
            />
          </div>
          
          <Button 
            onClick={validateSeedPhrase} 
            disabled={validating || !userSeedPhrase.trim()}
            className="w-full py-1 h-8 text-xs"
            size="sm"
          >
            {validating ? (
              <>
                <RefreshCw className="animate-spin h-3 w-3 mr-1" />
                Проверка...
              </>
            ) : "Проверить seed-фразу"}
          </Button>
          
          {validationResult && (
            <Card className={`${validationResult.valid ? 'bg-green-50' : 'bg-destructive/10'}`}>
              <CardContent className="p-2">
                {validationResult.valid ? (
                  <>
                    <h4 className="font-medium text-green-700 text-xs">Seed-фраза валидна</h4>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Связанные адреса:
                    </p>
                    <div className="space-y-2">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">BTC</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-5 px-2 flex items-center"
                            onClick={() => {
                              navigator.clipboard.writeText(validationResult.addresses?.btc || "");
                              toast({ title: "Скопировано", description: "Bitcoin-адрес скопирован" });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            <span className="text-xs">Копировать</span>
                          </Button>
                        </div>
                        <div className="bg-black/5 rounded p-1.5 text-xs font-mono break-all">
                          {validationResult.addresses?.btc}
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs">ETH</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-5 px-2 flex items-center"
                            onClick={() => {
                              navigator.clipboard.writeText(validationResult.addresses?.eth || "");
                              toast({ title: "Скопировано", description: "Ethereum-адрес скопирован" });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            <span className="text-xs">Копировать</span>
                          </Button>
                        </div>
                        <div className="bg-black/5 rounded p-1.5 text-xs font-mono break-all">
                          {validationResult.addresses?.eth}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-destructive">
                    {validationResult.message || "Невалидная seed-фраза. Проверьте правильность ввода."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}