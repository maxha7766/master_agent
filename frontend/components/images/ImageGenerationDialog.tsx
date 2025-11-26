'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

interface ImageGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (params: ImageGenerationParams) => void;
}

export interface ImageGenerationParams {
  operation: 'text-to-image' | 'image-to-image' | 'inpaint' | 'upscale' | 'variation';
  prompt: string;
  negativePrompt?: string;
  sourceImage?: string;
  maskImage?: string;
  size?: string;
  creativityMode?: 'precise' | 'balanced' | 'creative';
  strength?: number;
  scaleFactor?: number;
  numVariations?: number;
  seed?: number;
}

export function ImageGenerationDialog({
  open,
  onOpenChange,
  onGenerate,
}: ImageGenerationDialogProps) {
  const [operation, setOperation] = useState<ImageGenerationParams['operation']>('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [maskImageUrl, setMaskImageUrl] = useState('');
  const [size, setSize] = useState('square');
  const [creativityMode, setCreativityMode] = useState<'precise' | 'balanced' | 'creative'>(
    'balanced'
  );
  const [strength, setStrength] = useState(0.8);
  const [scaleFactor, setScaleFactor] = useState(2);
  const [numVariations, setNumVariations] = useState(3);
  const [seed, setSeed] = useState<number | undefined>(undefined);

  const handleGenerate = () => {
    const params: ImageGenerationParams = {
      operation,
      prompt,
      negativePrompt: negativePrompt || undefined,
      size,
      creativityMode,
    };

    if (operation !== 'text-to-image' && sourceImageUrl) {
      params.sourceImage = sourceImageUrl;
    }

    if (operation === 'inpaint' && maskImageUrl) {
      params.maskImage = maskImageUrl;
    }

    if (operation === 'image-to-image') {
      params.strength = strength;
    }

    if (operation === 'upscale') {
      params.scaleFactor = scaleFactor;
    }

    if (operation === 'variation') {
      params.numVariations = numVariations;
    }

    if (seed !== undefined) {
      params.seed = seed;
    }

    onGenerate(params);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#2a2a2a] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl">Generate Image</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create or edit images using AI. Choose an operation and provide details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Operation Type */}
          <div className="space-y-2">
            <Label htmlFor="operation">Operation</Label>
            <Select value={operation} onValueChange={(v) => setOperation(v as any)}>
              <SelectTrigger id="operation" className="bg-[#1e1e1e] border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2a2a2a] border-gray-700">
                <SelectItem value="text-to-image">Text to Image</SelectItem>
                <SelectItem value="image-to-image">Edit Image</SelectItem>
                <SelectItem value="inpaint">Inpaint (Fill Masked Area)</SelectItem>
                <SelectItem value="upscale">Upscale</SelectItem>
                <SelectItem value="variation">Create Variations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs for better organization */}
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#1e1e1e]">
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-4 mt-4">
              {/* Prompt */}
              {operation !== 'upscale' && (
                <div className="space-y-2">
                  <Label htmlFor="prompt">
                    Prompt {operation === 'text-to-image' && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      operation === 'text-to-image'
                        ? 'Describe what you want to see in detail...'
                        : 'Describe how to modify the image...'
                    }
                    className="min-h-[100px] bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Source Image */}
              {operation !== 'text-to-image' && (
                <div className="space-y-2">
                  <Label htmlFor="sourceImage">
                    Source Image URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sourceImage"
                    value={sourceImageUrl}
                    onChange={(e) => setSourceImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Mask Image */}
              {operation === 'inpaint' && (
                <div className="space-y-2">
                  <Label htmlFor="maskImage">
                    Mask Image URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="maskImage"
                    value={maskImageUrl}
                    onChange={(e) => setMaskImageUrl(e.target.value)}
                    placeholder="https://... (black and white mask)"
                    className="bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Size */}
              {operation === 'text-to-image' || operation === 'image-to-image' || operation === 'inpaint' ? (
                <div className="space-y-2">
                  <Label htmlFor="size">Size / Aspect Ratio</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="size" className="bg-[#1e1e1e] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-gray-700">
                      <SelectItem value="square">Square (1024×1024)</SelectItem>
                      <SelectItem value="portrait">Portrait (1024×1792)</SelectItem>
                      <SelectItem value="landscape">Landscape (1792×1024)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              {/* Creativity Mode */}
              {operation !== 'upscale' && (
                <div className="space-y-2">
                  <Label htmlFor="creativity">Creativity Mode</Label>
                  <Select
                    value={creativityMode}
                    onValueChange={(v) => setCreativityMode(v as any)}
                  >
                    <SelectTrigger id="creativity" className="bg-[#1e1e1e] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-gray-700">
                      <SelectItem value="precise">Precise (Follows prompt closely)</SelectItem>
                      <SelectItem value="balanced">Balanced (Recommended)</SelectItem>
                      <SelectItem value="creative">Creative (More artistic freedom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Negative Prompt */}
              {operation !== 'upscale' && operation !== 'variation' && (
                <div className="space-y-2">
                  <Label htmlFor="negativePrompt">Negative Prompt (Optional)</Label>
                  <Textarea
                    id="negativePrompt"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Things to avoid (e.g., blurry, low quality, distorted)"
                    className="min-h-[60px] bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              {/* Strength (for image-to-image) */}
              {operation === 'image-to-image' && (
                <div className="space-y-2">
                  <Label htmlFor="strength">
                    Transformation Strength: {strength.toFixed(1)}
                  </Label>
                  <Slider
                    id="strength"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[strength]}
                    onValueChange={(v) => setStrength(v[0])}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400">
                    0 = minimal change, 1 = complete transformation
                  </p>
                </div>
              )}

              {/* Scale Factor (for upscale) */}
              {operation === 'upscale' && (
                <div className="space-y-2">
                  <Label htmlFor="scaleFactor">Scale Factor</Label>
                  <Select
                    value={String(scaleFactor)}
                    onValueChange={(v) => setScaleFactor(Number(v))}
                  >
                    <SelectTrigger id="scaleFactor" className="bg-[#1e1e1e] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-gray-700">
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="4">4x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Number of Variations */}
              {operation === 'variation' && (
                <div className="space-y-2">
                  <Label htmlFor="numVariations">Number of Variations: {numVariations}</Label>
                  <Slider
                    id="numVariations"
                    min={1}
                    max={5}
                    step={1}
                    value={[numVariations]}
                    onValueChange={(v) => setNumVariations(v[0])}
                    className="w-full"
                  />
                </div>
              )}

              {/* Seed */}
              <div className="space-y-2">
                <Label htmlFor="seed">Seed (Optional)</Label>
                <Input
                  id="seed"
                  type="number"
                  value={seed ?? ''}
                  onChange={(e) =>
                    setSeed(e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Random (leave empty for random)"
                  className="bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-400">
                  Use the same seed for reproducible results
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-[#1e1e1e] border-gray-700 hover:bg-[#2a2a2a]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={
                !prompt.trim() && operation !== 'upscale' ||
                (operation !== 'text-to-image' && !sourceImageUrl) ||
                (operation === 'inpaint' && !maskImageUrl)
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Generate Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
