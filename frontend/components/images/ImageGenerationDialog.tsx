'use client';

import { useState, useRef } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface ImageGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (params: ImageGenerationParams) => void;
}

export interface ImageGenerationParams {
  prompt: string;
  inputImage?: string;
  aspectRatio?: string;
  outputFormat?: 'png' | 'jpg';
  safetyTolerance?: number;
  promptUpsampling?: boolean;
  seed?: number;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '21:9', label: '21:9 (Ultra-wide)' },
  { value: '9:21', label: '9:21 (Ultra-tall)' },
  { value: '2:1', label: '2:1' },
  { value: '1:2', label: '1:2' },
];

export function ImageGenerationDialog({
  open,
  onOpenChange,
  onGenerate,
}: ImageGenerationDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [outputFormat, setOutputFormat] = useState<'png' | 'jpg'>('png');
  const [safetyTolerance, setSafetyTolerance] = useState(2);
  const [promptUpsampling, setPromptUpsampling] = useState(false);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInputImage = !!(inputImageUrl || uploadedImageUrl);
  const effectiveInputImage = uploadedImageUrl || inputImageUrl;

  // Enforce max safety tolerance of 2 when using input image
  const maxSafetyTolerance = hasInputImage ? 2 : 6;
  const effectiveSafetyTolerance = Math.min(safetyTolerance, maxSafetyTolerance);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('Please sign in to upload images');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/images/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setUploadedImageUrl(data.url);
      setInputImageUrl(''); // Clear URL input when uploading
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const clearUploadedImage = () => {
    setUploadedImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    const params: ImageGenerationParams = {
      prompt: prompt.trim(),
      aspectRatio,
      outputFormat,
      safetyTolerance: effectiveSafetyTolerance,
      promptUpsampling,
    };

    if (effectiveInputImage) {
      params.inputImage = effectiveInputImage;
    }

    if (seed !== undefined) {
      params.seed = seed;
    }

    onGenerate(params);
    onOpenChange(false);

    // Reset form
    setPrompt('');
    setInputImageUrl('');
    setUploadedImageUrl(null);
    setAspectRatio('1:1');
    setOutputFormat('png');
    setSafetyTolerance(2);
    setPromptUpsampling(false);
    setSeed(undefined);
  };

  const getSafetyLabel = (value: number) => {
    if (value === 0) return 'Strictest';
    if (value <= 2) return 'Moderate';
    if (value <= 4) return 'Relaxed';
    return 'Permissive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#2a2a2a] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl">Generate Image</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create images using Flux Kontext Pro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">
              Prompt <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to create or how to edit the image..."
              className="min-h-[100px] bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Input Image */}
          <div className="space-y-2">
            <Label htmlFor="inputImage">Input Image (optional)</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="inputImage"
                  value={inputImageUrl}
                  onChange={(e) => {
                    setInputImageUrl(e.target.value);
                    setUploadedImageUrl(null); // Clear uploaded when typing URL
                  }}
                  placeholder="https://... or upload"
                  className="bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500 pr-10"
                  disabled={!!uploadedImageUrl}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-[#1e1e1e] border-gray-700 hover:bg-[#2a2a2a]"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Uploaded image preview */}
            {uploadedImageUrl && (
              <div className="relative inline-block mt-2">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded"
                  className="h-20 rounded border border-gray-700"
                />
                <button
                  onClick={clearUploadedImage}
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Provide an image URL or upload to edit an existing image
            </p>
          </div>

          {/* Aspect Ratio & Output Format - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aspectRatio">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger id="aspectRatio" className="bg-[#1e1e1e] border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-gray-700 max-h-[200px]">
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outputFormat">Output Format</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as 'png' | 'jpg')}>
                <SelectTrigger id="outputFormat" className="bg-[#1e1e1e] border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2a2a2a] border-gray-700">
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpg">JPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Safety Tolerance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="safetyTolerance">Safety Tolerance</Label>
              <span className="text-sm text-gray-400">
                {effectiveSafetyTolerance} - {getSafetyLabel(effectiveSafetyTolerance)}
              </span>
            </div>
            <Slider
              id="safetyTolerance"
              min={0}
              max={maxSafetyTolerance}
              step={1}
              value={[effectiveSafetyTolerance]}
              onValueChange={(v) => setSafetyTolerance(v[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (Strictest)</span>
              <span>{maxSafetyTolerance} (Most permissive)</span>
            </div>
            {hasInputImage && (
              <p className="text-xs text-yellow-500">
                Max 2 when using input image
              </p>
            )}
          </div>

          {/* Prompt Upsampling */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="promptUpsampling"
              checked={promptUpsampling}
              onCheckedChange={(checked) => setPromptUpsampling(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="promptUpsampling" className="cursor-pointer">
                Prompt Upsampling
              </Label>
              <p className="text-xs text-gray-500">
                Automatically improve and expand your prompt
              </p>
            </div>
          </div>

          {/* Seed */}
          <div className="space-y-2">
            <Label htmlFor="seed">Seed (optional)</Label>
            <Input
              id="seed"
              type="number"
              value={seed ?? ''}
              onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Random (leave empty for random)"
              className="bg-[#1e1e1e] border-gray-700 text-white placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500">
              Use the same seed for reproducible results
            </p>
          </div>

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
              disabled={!prompt.trim()}
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
