import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NFTCollectionView } from '@/components/nft/nft-collection';
import { NFTGallery } from '@/components/nft/nft-gallery';
import { PageHeader } from '@/components/ui/page-header';

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