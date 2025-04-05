import React, { useState, useEffect } from 'react';
import { getProxiedImageUrl } from '../../lib/image-utils';

interface NFTImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
}

/**
 * Компонент для отображения NFT изображений с автоматической обработкой ошибок
 * и повторными попытками загрузки
 */
export const NFTImage: React.FC<NFTImageProps> = ({
  src,
  alt,
  className = "w-full h-full object-cover",
  fallbackSrc = "/public/assets/nft/placeholder.png"
}) => {
  const [imageSrc, setImageSrc] = useState<string>(getProxiedImageUrl(src));
  const [error, setError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  // При изменении исходного src, сбрасываем состояния и обновляем путь
  useEffect(() => {
    setImageSrc(getProxiedImageUrl(src));
    setError(false);
    setRetryCount(0);
  }, [src]);

  // Обрабатываем ошибку загрузки изображения
  const handleError = () => {
    // Если мы еще не достигли максимального количества попыток, пробуем еще раз
    if (retryCount < maxRetries) {
      console.log(`NFT Image load error for ${src}, retry ${retryCount + 1}/${maxRetries}`);
      
      // Увеличиваем счетчик попыток
      setRetryCount(prev => prev + 1);
      
      // Добавляем случайный параметр к URL для обхода кеша
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000000);
      
      // Формируем новый URL с дополнительными параметрами, указывающими, что это повторная попытка
      const newSrc = getProxiedImageUrl(`${src}?nocache=${timestamp}&retry=${retryCount + 1}&r=${random}`);
      
      // Устанавливаем небольшую задержку перед следующей попыткой
      setTimeout(() => {
        setImageSrc(newSrc);
      }, 500);
    } else {
      // Если все попытки исчерпаны, устанавливаем fallback изображение
      console.log(`NFT Image load failed after ${maxRetries} retries for ${src}, using fallback`);
      setError(true);
      setImageSrc(fallbackSrc);
    }
  };

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
};