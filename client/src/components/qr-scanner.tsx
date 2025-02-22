import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/library';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);

  const startScanning = async () => {
    try {
      setIsStarting(true);
      setError(null);

      // Создаем новый сканер
      readerRef.current = new BrowserQRCodeReader();

      // Получаем список камер
      const videoInputDevices = await readerRef.current.listVideoInputDevices();

      // Используем заднюю камеру на мобильных устройствах
      const selectedDeviceId = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      )?.deviceId || videoInputDevices[0]?.deviceId;

      if (!selectedDeviceId) {
        throw new Error('Камера не найдена');
      }

      // Начинаем сканирование
      await readerRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current!,
        (result) => {
          if (result) {
            try {
              const data = JSON.parse(result.getText());
              if (data.type === 'usd_card' || data.type === 'crypto_wallet') {
                const recipient = data.type === 'usd_card' ? data.cardNumber : data.walletAddress;
                onScanSuccess(recipient, data.type);
              }
            } catch (e) {
              console.error('Invalid QR code format:', e);
            }
          }
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Ошибка при запуске камеры. Проверьте разрешения.');
      setIsScanning(false);
    } finally {
      setIsStarting(false);
    }
  };

  const stopScanning = async () => {
    if (readerRef.current) {
      await readerRef.current.reset();
      readerRef.current = null;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ maxHeight: '300px' }}
        />

        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-center px-4">
              Нажмите "Начать сканирование" и разрешите доступ к камере
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-destructive text-sm text-center px-4">{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={isScanning ? stopScanning : startScanning}
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