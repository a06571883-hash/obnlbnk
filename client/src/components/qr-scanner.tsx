import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Loader2, Camera } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanning = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Ваш браузер не поддерживает доступ к камере');
        return;
      }

      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });

      // Initialize scanner
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      console.log('Available cameras:', devices);

      if (devices && devices.length > 0) {
        const cameraId = devices[0].id;
        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              if (data.type && (data.cardNumber || data.walletAddress)) {
                scannerRef.current?.stop();
                onScanSuccess(
                  data.cardNumber || data.walletAddress,
                  data.type as 'usd_card' | 'crypto_wallet'
                );
                onClose();
              }
            } catch (e) {
              console.error('QR decode error:', e);
              setError('Неверный формат QR-кода');
            }
          },
          (errorMessage) => {
            console.error('QR scan error:', errorMessage);
          }
        );
        setIsScanning(true);
        setError(null);
      } else {
        setError('Камера не найдена');
      }
    } catch (err) {
      console.error('Camera initialization error:', err);
      setError('Ошибка доступа к камере. Пожалуйста, разрешите доступ к камере.');
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div 
        id="qr-reader" 
        className="w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden"
        style={{ minHeight: '300px' }}
      />

      {error && (
        <p className="text-destructive text-sm text-center mt-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant={isScanning ? "destructive" : "default"}
          onClick={() => {
            if (isScanning) {
              stopScanning();
            } else {
              startScanning();
            }
          }}
          className="w-full"
        >
          {isScanning ? (
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