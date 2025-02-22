import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const startScanning = async () => {
    try {
      setIsStarting(true);
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Ваше устройство не поддерживает доступ к камере');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();

      setIsScanning(true);
      scanQRCode();

    } catch (err) {
      console.error('Camera error:', err);
      let errorMessage = 'Ошибка доступа к камере';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Пожалуйста, разрешите доступ к камере';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Камера не найдена на устройстве';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Камера уже используется другим приложением';
        }
      }

      setError(errorMessage);
      setIsScanning(false);
    } finally {
      setIsStarting(false);
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      try {
        const data = JSON.parse(code.data);
        if (data.type === 'usd_card' || data.type === 'crypto_wallet') {
          const recipient = data.type === 'usd_card' ? data.cardNumber : data.walletAddress;
          onScanSuccess(recipient, data.type);
          return;
        }
      } catch (e) {
        console.error('Invalid QR code format:', e);
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ maxHeight: '300px' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />

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