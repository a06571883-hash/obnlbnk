import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Card } from '@shared/schema';

interface QRCodeGeneratorProps {
  card: Card;
  type: 'card' | 'btc' | 'eth';
}

export default function QRCodeGenerator({ card, type }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const data = {
      type: type === 'card' ? 'usd_card' : 'crypto_wallet',
      ...(type === 'card' 
        ? { cardNumber: card.number }
        : { walletAddress: type === 'btc' ? card.btcAddress : card.ethAddress }
      )
    };

    QRCode.toCanvas(
      canvasRef.current,
      JSON.stringify(data),
      {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }
    );
  }, [card, type]);

  return (
    <div className="flex justify-center">
      <canvas ref={canvasRef} />
    </div>
  );
}
