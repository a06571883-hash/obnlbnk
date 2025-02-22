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
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startScanning = async () => {
    try {
      setIsStarting(true);
      setError(null);
      console.log('Starting camera initialization...');

      // Проверка HTTPS для мобильных устройств
      if (window.location.protocol !== 'https:') {
        console.warn('Camera access might require HTTPS on mobile devices');
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Ваш браузер не поддерживает доступ к камере');
      }

      // Даём устройству время на инициализацию камеры
      await new Promise(resolve => setTimeout(resolve, 1000));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log('Available cameras:', cameras.length);
      cameras.forEach((camera, index) => {
        console.log(`Camera ${index}:`, camera.label || 'unnamed camera');
      });

      if (cameras.length === 0) {
        throw new Error('Камеры не найдены на устройстве');
      }

      // Упрощённые настройки для большей совместимости
      const constraints = {
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      console.log('Requesting camera with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Stream obtained:', stream.id);
      console.log('Video tracks:', stream.getVideoTracks().length);

      if (!videoRef.current) {
        throw new Error('Video element not initialized');
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      // Упрощаем обработку событий
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Video playback started successfully');
            setIsScanning(true);
          })
          .catch(err => {
            console.error('Error during playback:', err);
            throw new Error('Не удалось запустить видеопоток');
          });
      }

    } catch (err) {
      console.error('Camera initialization error:', err);
      let errorMessage = 'Произошла ошибка при доступе к камере';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Пожалуйста, разрешите доступ к камере в настройках браузера';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Камера не найдена на вашем устройстве';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Камера занята другим приложением';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Не удалось найти заднюю камеру. Попробуйте другую камеру.';
          // Повторяем попытку без exact constraint
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              streamRef.current = stream;
              await videoRef.current.play();
              setIsScanning(true);
              return; // Успешно получили доступ к камере
            }
          } catch (retryErr) {
            console.error('Retry failed:', retryErr);
          }
        } else {
          errorMessage = `Ошибка: ${err.message}`;
        }
      }

      setError(errorMessage);
      setIsScanning(false);
    } finally {
      setIsStarting(false);
    }
  };

  const stopScanning = () => {
    console.log('Stopping camera...');
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        console.log(`Stopping track: ${track.label}`);
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    console.log('Camera stopped');
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