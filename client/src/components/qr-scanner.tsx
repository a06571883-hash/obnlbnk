import { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    const startScanning = async () => {
      try {
        setIsLoading(true);
        setError(null);

        scanner = new Html5Qrcode("qr-reader");
        const devices = await Html5Qrcode.getCameras();

        if (devices && devices.length > 0) {
          const cameraId = devices[0].id;
          await scanner.start(
            cameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1,
            },
            async (decodedText) => {
              try {
                const data = JSON.parse(decodedText);
                if (data.type && (data.cardNumber || data.walletAddress)) {
                  await scanner?.stop();
                  onScanSuccess(
                    data.cardNumber || data.walletAddress,
                    data.type as 'usd_card' | 'crypto_wallet'
                  );
                  onClose();
                } else {
                  setError('Неверный формат QR кода');
                }
              } catch (e) {
                setError('Неверный формат QR кода');
              }
            },
            (errorMessage) => {
              console.warn(`QR Error: ${errorMessage}`);
            }
          );
          setIsScanning(true);
        } else {
          setError('Камера не найдена');
        }
      } catch (err) {
        setError('Ошибка доступа к камере. Пожалуйста, предоставьте разрешение.');
      } finally {
        setIsLoading(false);
      }
    };

    if (isScanning) {
      startScanning();
    }

    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [isScanning, onScanSuccess, onClose]);

  return (
    <div className="p-4">
      <div id="qr-reader" className="w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" />

      {error && (
        <p className="text-red-500 text-sm text-center mt-4">{error}</p>
      )}

      <Button
        onClick={() => setIsScanning(!isScanning)}
        disabled={isLoading}
        className="w-full mt-4"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Подключение к камере...
          </>
        ) : isScanning ? (
          'Отменить сканирование'
        ) : (
          'Начать сканирование'
        )}
      </Button>
    </div>
  );
}