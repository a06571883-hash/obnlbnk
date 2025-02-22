import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import Webcam from 'react-webcam';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const startCamera = async () => {
    try {
      setIsStarting(true);
      setError(null);
      setCameraEnabled(true);
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Произошла неизвестная ошибка при доступе к камере');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    setCameraEnabled(false);
  };

  const videoConstraints = {
    width: 720,
    height: 720,
    facingMode: 'environment'
  };

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
        {cameraEnabled && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMediaError={(err) => {
              console.error('Webcam error:', err);
              setError('Ошибка доступа к камере. Пожалуйста, разрешите доступ.');
              setCameraEnabled(false);
            }}
            className="w-full h-full object-cover"
          />
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-destructive text-sm text-center px-4">{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            if (cameraEnabled) {
              stopCamera();
            } else {
              startCamera();
            }
          }}
          disabled={isStarting}
          className="w-full"
          variant={cameraEnabled ? "destructive" : "default"}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Подключение к камере...
            </>
          ) : cameraEnabled ? (
            'Остановить камеру'
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" />
              Включить камеру
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