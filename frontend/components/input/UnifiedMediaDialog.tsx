'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageIcon, Film } from 'lucide-react';
import { ImageGenerationForm, ImageGenerationParams } from '@/components/images/ImageGenerationForm';
import { VideoGenerator } from '@/components/video/VideoGenerator';
import { useState } from 'react';

interface UnifiedMediaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerateImage: (params: ImageGenerationParams) => void;
}

export function UnifiedMediaDialog({
    open,
    onOpenChange,
    onGenerateImage,
}: UnifiedMediaDialogProps) {
    const [activeTab, setActiveTab] = useState('image');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[#2a2a2a] text-white border-gray-700">
                <DialogHeader>
                    <DialogTitle className="text-xl">Media Studio</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Generate images and videos using advanced AI models
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="bg-[#1e1e1e] border border-gray-700 w-full justify-start">
                        <TabsTrigger value="image" className="gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Image Generation
                        </TabsTrigger>
                        <TabsTrigger value="video" className="gap-2">
                            <Film className="w-4 h-4" />
                            Video Generation
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="image" className="mt-4">
                        <ImageGenerationForm
                            onGenerate={(params) => {
                                onGenerateImage(params);
                                onOpenChange(false);
                            }}
                            onCancel={() => onOpenChange(false)}
                        />
                    </TabsContent>

                    <TabsContent value="video" className="mt-4 h-[600px] overflow-y-auto">
                        <VideoGenerator />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
