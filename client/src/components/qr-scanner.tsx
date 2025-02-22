import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import Webcam from 'react-webcam';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: { ideal: 'environment' }
};

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const handleUserMedia = useCallback(() => {
    setIsScanning(true);
    setError(null);
  }, []);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    let errorMessage = 'Ошибка доступа к камере';

    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Пожалуйста, разрешите доступ к камере';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Камера не найдена на устройстве';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Камера уже используется другим приложением';
      }
    }

    setError(errorMessage);
    setIsScanning(false);
  }, []);

  const startScanning = async () => {
    setIsStarting(true);
    setError(null);
    setIsScanning(true);
  };

  const stopScanning = () => {
    if (webcamRef.current) {
      const stream = webcamRef.current.video?.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div 
        className="relative w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" 
        style={{ minHeight: '300px' }}
      >
        {isScanning && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="w-full h-full object-cover"
            style={{ maxHeight: '300px' }}
          />
        )}

        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-center px-4">
              Нажмите кнопку "Начать сканирование" и разрешите доступ к камере
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