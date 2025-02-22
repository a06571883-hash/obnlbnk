import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setIsStarting(true);
      setError(null);

      console.log('Starting camera...');

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Ваш браузер не поддерживает доступ к камере');
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      console.log('Requesting camera with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained:', stream);

      if (videoRef.current) {
        console.log('Setting video source');
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        // Важно: добавляем обработчик события loadedmetadata
        videoRef.current.onloadedmetadata = async () => {
          console.log('Video metadata loaded');
          try {
            await videoRef.current?.play();
            console.log('Video playback started');
          } catch (playError) {
            console.error('Error playing video:', playError);
            setError('Ошибка воспроизведения видео');
          }
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Пожалуйста, разрешите доступ к камере в настройках браузера');
        } else if (err.name === 'NotFoundError') {
          setError('Камера не найдена на вашем устройстве');
        } else {
          setError(`Ошибка камеры: ${err.message}`);
        }
      } else {
        setError('Произошла неизвестная ошибка при доступе к камере');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
        />

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-destructive text-sm text-center px-4">{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            console.log('Camera button clicked');
            if (streamRef.current) {
              stopCamera();
            } else {
              startCamera();
            }
          }}
          disabled={isStarting}
          className="w-full"
          variant={streamRef.current ? "destructive" : "default"}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Подключение к камере...
            </>
          ) : streamRef.current ? (
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