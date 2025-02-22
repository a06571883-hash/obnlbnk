import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Создаем сканер с базовыми настройками
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
      },
      false
    );

    // Обработчик успешного сканирования
    const onScanSuccess = (decodedText: string) => {
      try {
        const data = JSON.parse(decodedText);
        if (data.type && (data.cardNumber || data.walletAddress)) {
          scanner.clear();
          onScanSuccess(
            data.cardNumber || data.walletAddress,
            data.type as 'usd_card' | 'crypto_wallet'
          );
          onClose();
        }
      } catch (error) {
        setError('Неверный формат QR-кода');
      }
    };

    // Обработчик ошибок
    const onScanError = (errorMessage: string) => {
      console.warn('QR ошибка:', errorMessage);
      if (errorMessage.includes('NotAllowedError')) {
        setError('Пожалуйста, разрешите доступ к камере');
      } else if (errorMessage.includes('NotFoundError')) {
        setError('Камера не найдена');
      }
    };

    // Запускаем сканер
    scanner.render(onScanSuccess, onScanError);

    // Очистка при размонтировании
    return () => {
      scanner.clear();
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="space-y-4">
      <div id="qr-reader" className="w-full max-w-sm mx-auto bg-background rounded-lg overflow-hidden" />
      {error && (
        <p className="text-destructive text-sm text-center mt-2">{error}</p>
      )}
      <Button variant="outline" onClick={onClose} className="w-full">
        Закрыть сканер
      </Button>
    </div>
  );
}