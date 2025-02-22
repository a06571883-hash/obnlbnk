import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScanSuccess: (cardNumber: string, type: 'usd_card' | 'crypto_wallet') => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  useEffect(() => {
    // Create instance
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: 250,
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true,
      },
      false
    );

    // Success callback
    const onScanSuccessCallback = (decodedText: string) => {
      try {
        const data = JSON.parse(decodedText);
        if (data.type && (data.cardNumber || data.walletAddress)) {
          scanner.clear();
          onScanSuccess(
            data.cardNumber || data.walletAddress,
            data.type as 'usd_card' | 'crypto_wallet'
          );
          onClose();
        } else {
          console.error('Invalid QR code format: Missing type or cardNumber/walletAddress');
        }
      } catch (error) {
        console.error('Invalid QR code format:', error);
      }
    };

    // Error callback
    const onScanError = (error: string) => {
      console.warn('QR scan error:', error);
    };

    // Render scanner
    scanner.render(onScanSuccessCallback, onScanError);

    // Cleanup
    return () => {
      scanner.clear();
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="space-y-4">
      <div id="qr-reader" className="w-full max-w-sm mx-auto" />
      <Button variant="outline" onClick={onClose} className="w-full">
        Закрыть сканер
      </Button>
    </div>
  );
}