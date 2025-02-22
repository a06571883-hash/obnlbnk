import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isScanning) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    const onScannerSuccess = (decodedText: string) => {
      try {
        const data = JSON.parse(decodedText);
        if (data.type && (data.cardNumber || data.walletAddress)) {
          onScanSuccess(
            data.cardNumber || data.walletAddress,
            data.type as 'usd_card' | 'crypto_wallet'
          );
          scanner.clear();
          onClose();
        } else {
          setError('Неверный формат QR кода');
        }
      } catch (e) {
        setError('Неверный формат QR кода');
      }
    };

    const onScannerError = (errorMessage: string) => {
      console.error('QR Scan Error:', errorMessage);
    };

    scanner.render(onScannerSuccess, onScannerError);

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [isScanning, onScanSuccess, onClose]);

  return (
    <div className="p-4">
      {!isScanning ? (
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Для сканирования QR-кода требуется доступ к камере
          </p>
          <Button 
            onClick={() => setIsScanning(true)}
            className="w-full"
          >
            Включить камеру
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div id="qr-reader" className="w-full max-w-sm mx-auto" />
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setIsScanning(false);
              onClose();
            }}
            className="w-full"
          >
            Отменить сканирование
          </Button>
        </div>
      )}
    </div>
  );
}
