import { useState, useEffect } from 'react';

interface GyroscopeData {
  beta: number;
  gamma: number;
}

type PermissionState = 'granted' | 'denied' | 'prompt';

export function useGyroscope() {
  const [rotation, setRotation] = useState<GyroscopeData | null>(null);
  const [permission, setPermission] = useState<PermissionState>('prompt');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;

    let animationFrameId: number;
    let lastUpdate = 0;
    const minUpdateInterval = 16; // ~60fps

    // Определяем iOS устройство
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    const requestPermission = async () => {
      if (isIOS && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          setPermission(permissionState);
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (error) {
          console.error('Error requesting device orientation permission:', error);
        }
      } else {
        // Для не iOS устройств
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdate < minUpdateInterval) return;
      lastUpdate = now;

      if (event.beta === null || event.gamma === null) return;

      // Настройка чувствительности в зависимости от устройства
      const sensitivity = isIOS ? 0.5 : 0.7;

      // Ограничиваем значения для более плавной анимации
      const beta = Math.max(-45, Math.min(45, event.beta));
      const gamma = Math.max(-45, Math.min(45, event.gamma));

      // Используем requestAnimationFrame для плавной анимации
      animationFrameId = requestAnimationFrame(() => {
        setRotation({
          beta: beta * sensitivity,
          gamma: gamma * sensitivity
        });
      });
    };

    // Автоматически запрашиваем разрешение при монтировании
    if (isIOS && isSafari) {
      // Для Safari на iOS требуется взаимодействие пользователя
      const handleUserInteraction = () => {
        requestPermission();
        document.removeEventListener('touchend', handleUserInteraction);
      };
      document.addEventListener('touchend', handleUserInteraction);
    } else {
      requestPermission();
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return rotation;
}