import React, { useState } from 'react';
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

export const NFTPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('gallery');

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
          <TabsTrigger value="gallery">Галерея</TabsTrigger>
          <TabsTrigger value="collections">Коллекции</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery">
          <NFTGallery />
        </TabsContent>
        <TabsContent value="collections">
          <NFTCollectionView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NFTPage;