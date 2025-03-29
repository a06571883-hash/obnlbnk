import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NFTImportAdmin } from "./nft-import-admin";

import { toast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle } from "lucide-react";

export function NFTAdmin() {
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [scriptResult, setScriptResult] = useState<{
    success?: boolean;
    output?: string;
    warnings?: string;
    error?: string;
  } | null>(null);

  const runAdminScript = async (script: string) => {
    setIsRunningScript(true);
    setScriptResult(null);
    
    try {
      const response = await fetch('/api/admin/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script }),
      });
      
      const result = await response.json();
      setScriptResult(result);
      
      if (result.success) {
        toast({
          title: "Скрипт выполнен успешно",
          description: "Операция выполнена без ошибок",
          variant: "default",
        });
      } else {
        toast({
          title: "Ошибка при выполнении скрипта",
          description: result.error || "Произошла неизвестная ошибка",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Ошибка при выполнении скрипта:", error);
      setScriptResult({
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка"
      });
      
      toast({
        title: "Ошибка при выполнении скрипта",
        description: error instanceof Error ? error.message : "Произошла неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsRunningScript(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Панель администратора NFT</h1>
      
      <Tabs defaultValue="importnft" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="importnft">Импорт NFT</TabsTrigger>
          <TabsTrigger value="adminscripts">Запуск скриптов</TabsTrigger>
        </TabsList>
        
        <TabsContent value="importnft">
          <Card>
            <CardHeader>
              <CardTitle>Импорт NFT Bored Ape в маркетплейс</CardTitle>
              <CardDescription>
                Импортирует коллекцию Bored Ape в маркетплейс для продажи
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NFTImportAdmin />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="adminscripts">
          <Card>
            <CardHeader>
              <CardTitle>Запуск административных скриптов</CardTitle>
              <CardDescription>
                Запуск специальных скриптов для работы с NFT и базой данных
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Button
                    onClick={() => runAdminScript('node import-all-nft-to-marketplace.js')}
                    disabled={isRunningScript}
                    variant="default"
                    className="w-full sm:w-auto"
                  >
                    {isRunningScript ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Выполняется...
                      </>
                    ) : (
                      <>Импортировать все NFT напрямую</>
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-1">
                    Импортирует все NFT из коллекции Bored Ape непосредственно в базу данных
                  </p>
                </div>
                
                <div>
                  <Button
                    onClick={() => runAdminScript('node rename-ape-files.js')}
                    disabled={isRunningScript}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {isRunningScript ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Выполняется...
                      </>
                    ) : (
                      <>Переименовать файлы NFT</>
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-1">
                    Стандартизирует имена файлов NFT для правильного импорта
                  </p>
                </div>
              </div>
              
              {scriptResult && (
                <div className="mt-6 border rounded-md p-4">
                  <div className="flex items-center mb-3">
                    {scriptResult.success ? (
                      <Check className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <h3 className="text-lg font-medium">
                      {scriptResult.success ? "Выполнено успешно" : "Произошла ошибка"}
                    </h3>
                  </div>
                  
                  {scriptResult.output && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-1">Вывод:</h4>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                        {scriptResult.output}
                      </pre>
                    </div>
                  )}
                  
                  {scriptResult.warnings && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium mb-1 text-yellow-600">Предупреждения:</h4>
                      <pre className="bg-yellow-50 p-2 rounded text-xs overflow-auto max-h-40">
                        {scriptResult.warnings}
                      </pre>
                    </div>
                  )}
                  
                  {scriptResult.error && (
                    <div>
                      <h4 className="text-sm font-medium mb-1 text-red-600">Ошибка:</h4>
                      <pre className="bg-red-50 p-2 rounded text-xs overflow-auto max-h-40">
                        {scriptResult.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}