import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Eye, EyeOff, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';

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
      const response = await fetch('/api/crypto/seed-phrase', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setData(data as SeedPhraseData);
    } catch (err) {
      console.error('Failed to fetch seed phrase:', err);
      setError('Не удалось получить seed-фразу. Пожалуйста, попробуйте позже.');
      toast({
        title: "Ошибка",
        description: "Не удалось получить seed-фразу",
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
      const response = await fetch('/api/crypto/verify-seed-phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ seedPhrase: userSeedPhrase })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
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
        description: "Не удалось проверить seed-фразу",
        variant: "destructive"
      });
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-medium">Ваша Seed-фраза</h3>
        <p className="text-sm text-muted-foreground">
          Это ваша личная seed-фраза для восстановления доступа к криптовалютным средствам. 
          Храните её в надежном месте и никому не сообщайте.
        </p>

        {loading ? (
          <Card className="bg-muted/50">
            <CardContent className="p-4 flex justify-center items-center h-20">
              <RefreshCw className="animate-spin h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={fetchSeedPhrase} variant="outline" className="mt-2" size="sm">
                Повторить попытку
              </Button>
            </CardContent>
          </Card>
        ) : data ? (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="relative">
                <div className={`bg-black/5 p-3 rounded-md font-mono text-sm break-all relative ${showPhrase ? '' : 'blur-sm select-none'}`}>
                  {data.seedPhrase}
                </div>
                <div className="absolute top-2 right-2 space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={() => setShowPhrase(!showPhrase)}
                  >
                    {showPhrase ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full" 
                    onClick={() => copyToClipboard(data.seedPhrase)}
                    disabled={!showPhrase || copied}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                Связанные адреса:
              </p>
              <div className="space-y-2 mt-2">
                <div className="text-xs">
                  <span className="font-semibold">BTC:</span> 
                  <span className="font-mono ml-2">{data.addresses.btc}</span>
                </div>
                <div className="text-xs">
                  <span className="font-semibold">ETH:</span> 
                  <span className="font-mono ml-2">{data.addresses.eth}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-medium">Проверить seed-фразу</h3>
        <p className="text-sm text-muted-foreground">
          Введите seed-фразу для проверки её валидности и получения связанных криптоадресов.
        </p>
        
        <div className="space-y-2">
          <Label htmlFor="seed-phrase">Введите seed-фразу</Label>
          <Input 
            id="seed-phrase" 
            value={userSeedPhrase}
            onChange={(e) => setUserSeedPhrase(e.target.value)}
            placeholder="Введите 12 слов, разделенных пробелами"
          />
        </div>
        
        <Button 
          onClick={validateSeedPhrase} 
          disabled={validating || !userSeedPhrase.trim()}
          className="w-full"
        >
          {validating ? (
            <>
              <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              Проверка...
            </>
          ) : "Проверить seed-фразу"}
        </Button>
        
        {validationResult && (
          <Card className={`${validationResult.valid ? 'bg-green-50' : 'bg-destructive/10'}`}>
            <CardContent className="p-4">
              {validationResult.valid ? (
                <>
                  <h4 className="font-medium text-green-700">Seed-фраза валидна</h4>
                  <p className="text-sm text-muted-foreground mt-2">
                    Связанные адреса:
                  </p>
                  <div className="space-y-2 mt-2">
                    <div className="text-xs">
                      <span className="font-semibold">BTC:</span> 
                      <span className="font-mono ml-2">{validationResult.addresses?.btc}</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold">ETH:</span> 
                      <span className="font-mono ml-2">{validationResult.addresses?.eth}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-destructive">
                  {validationResult.message || "Невалидная seed-фраза. Проверьте правильность ввода."}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}