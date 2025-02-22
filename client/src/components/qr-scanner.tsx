import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    try {
      setIsStarting(true);
      setError(null);

      if (!containerRef.current) return;

      // Initialize scanner
      html5QrCode.current = new Html5Qrcode("qr-reader");

      const qrCodeSuccessCallback = (decodedText: string) => {
        try {
          const data = JSON.parse(decodedText);
          if (data.type === 'usd_card' || data.type === 'crypto_wallet') {
            const recipient = data.type === 'usd_card' ? data.cardNumber : data.walletAddress;
            onScanSuccess(recipient, data.type);
          }
        } catch (e) {
          console.error('Invalid QR code format:', e);
        }
      };

      const config = { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1
      };

      await html5QrCode.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        undefined
      );

      setIsScanning(true);
    } catch (err) {
      console.error('QR Scanner error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла ошибка при запуске сканера');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCode.current && isScanning) {
      try {
        await html5QrCode.current.stop();
        html5QrCode.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div 
        id="qr-reader" 
        ref={containerRef}
        className="relative w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" 
        style={{ minHeight: '300px' }}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <p className="text-destructive text-sm text-center px-4">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => {
            if (isScanning) {
              stopScanning();
            } else {
              startScanning();
            }
          }}
          disabled={isStarting}
          className="w-full"
          variant={isScanning ? "destructive" : "default"}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Подключение к камере...
            </>
          ) : isScanning ? (
            'Остановить сканирование'
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Начать сканирование
            </>
          )}
        </Button>

        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
}