import React, { useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NFTCollectionView } from '../components/nft/nft-collection';
import { NFTGallery } from '../components/nft/nft-gallery';

// Simple PageHeader component to avoid import issues
const PageHeader: React.FC<{title: string; description: string}> = ({title, description}) => (
  <div className="mb-6">
    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    <p className="text-muted-foreground mt-2">{description}</p>
  </div>
);

// Тип для навигации между вкладками
export type NFTTabNavigation = {
  switchToCollections: () => void;
  switchToGallery: () => void;
};

export const NFTPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('gallery');
  const galleryTabRef = useRef<HTMLButtonElement>(null);
  const collectionsTabRef = useRef<HTMLButtonElement>(null);
  
  // Функции для программного переключения между вкладками
  const switchToCollections = useCallback(() => {
    console.log('Переключение на вкладку коллекций');
    setActiveTab('collections');
    
    // Дополнительно можно анимировать клик для визуальной обратной связи
    if (collectionsTabRef.current) {
      collectionsTabRef.current.click();
    }
  }, []);
  
  const switchToGallery = useCallback(() => {
    console.log('Переключение на вкладку галереи');
    setActiveTab('gallery');
    
    // Дополнительно можно анимировать клик для визуальной обратной связи
    if (galleryTabRef.current) {
      galleryTabRef.current.click();
    }
  }, []);
  
  // Объект навигации, который будет передан в дочерние компоненты
  const tabNavigation: NFTTabNavigation = {
    switchToCollections,
    switchToGallery
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="NFT Коллекция"
        description="Создавайте, просматривайте и управляйте вашими NFT активами"
      />

      <Tabs
        defaultValue="gallery"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger 
            value="gallery" 
            ref={galleryTabRef}
            id="gallery-tab"
          >
            Галерея
          </TabsTrigger>
          <TabsTrigger 
            value="collections" 
            ref={collectionsTabRef}
            id="collections-tab"
          >
            Коллекции
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gallery">
          <NFTGallery navigation={tabNavigation} />
        </TabsContent>
        <TabsContent value="collections">
          <NFTCollectionView navigation={tabNavigation} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NFTPage;