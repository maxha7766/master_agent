'use client';

import { useState, useRef, useEffect } from 'react';
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
import { Loader2, Upload, X, Play, Film } from 'lucide-react';
import { toast } from 'sonner';
import { wsClient } from '../../lib/websocket';
import { supabase } from '../../lib/supabase';

export interface VideoGenerationParams {
    prompt: string;
    sourceImage?: string;
    duration?: 5 | 10;
    resolution?: '720p' | '1080p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    model?: 'google/veo-3' | 'kuaishou/kling-2.1';
}

export function VideoGenerator() {
    const [prompt, setPrompt] = useState('');
    const [mode, setMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video');
    const [model, setModel] = useState<'google/veo-3' | 'kuaishou/kling-2.1'>('google/veo-3');
    const [duration, setDuration] = useState<'5' | '10'>('5');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');

    const [uploading, setUploading] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    // WebSocket listeners
    useEffect(() => {
        const unsubscribe = wsClient.onMessage((message) => {
            if (message.kind === 'progress') {
                setProgress(message.progressPercent);
                setStatus(message.status);
            } else if (message.kind === 'video_result') {
                setGenerating(false);
                setGeneratedVideoUrl(message.data.videoUrl);
                toast.success('Video generated successfully!');
                setProgress(0);
                setStatus('');
            } else if (message.kind === 'error') {
                setGenerating(false);
                toast.error(`Error: ${message.error}`);
                setProgress(0);
                setStatus('');
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

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
            toast.success('Image uploaded successfully');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleGenerate = () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        if (mode === 'image-to-video' && !uploadedImageUrl) {
            toast.error('Please upload a source image');
            return;
        }

        if (!wsClient.isConnected()) {
            toast.error('Not connected to server');
            return;
        }

        setGenerating(true);
        setGeneratedVideoUrl(null);
        setProgress(0);
        setStatus('Starting generation...');

        const params: VideoGenerationParams = {
            prompt: prompt.trim(),
            duration: parseInt(duration) as 5 | 10,
            resolution,
            aspectRatio: aspectRatio as any,
            model, // Pass selected model
        };

        if (mode === 'image-to-video' && uploadedImageUrl) {
            params.sourceImage = uploadedImageUrl;
        }

        wsClient.send({
            kind: 'video_generate',
            operation: mode,
            parameters: params,
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="flex items-center space-x-3 mb-6">
                <Film className="w-8 h-8 text-blue-500" />
                <h1 className="text-3xl font-bold text-white">Video Generator</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Controls Column */}
                <div className="space-y-6 bg-[#2a2a2a] p-6 rounded-xl border border-gray-800">
                    <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                        <TabsList className="w-full bg-[#1e1e1e]">
                            <TabsTrigger value="text-to-video" className="flex-1">Text to Video</TabsTrigger>
                            <TabsTrigger value="image-to-video" className="flex-1">Image to Video</TabsTrigger>
                        </TabsList>

                        <TabsContent value="text-to-video" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Prompt</Label>
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the video you want to generate..."
                                    className="min-h-[120px] bg-[#1e1e1e] border-gray-700"
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="image-to-video" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Source Image</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={uploadedImageUrl || ''}
                                        readOnly
                                        placeholder="Upload an image..."
                                        className="bg-[#1e1e1e] border-gray-700"
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="bg-[#1e1e1e] border-gray-700"
                                    >
                                        {uploading ? <Loader2 className="animate-spin" /> : <Upload className="w-4 h-4" />}
                                    </Button>
                                </div>
                                {uploadedImageUrl && (
                                    <div className="relative w-full h-40 bg-black rounded-lg overflow-hidden border border-gray-700">
                                        <img src={uploadedImageUrl} alt="Source" className="w-full h-full object-contain" />
                                        <button
                                            onClick={() => setUploadedImageUrl(null)}
                                            className="absolute top-2 right-2 bg-red-600 p-1 rounded-full hover:bg-red-700"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Prompt (Optional)</Label>
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe the motion or changes..."
                                    className="bg-[#1e1e1e] border-gray-700"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Model</Label>
                            <Select value={model} onValueChange={(v: any) => setModel(v)}>
                                <SelectTrigger className="bg-[#1e1e1e] border-gray-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2a2a2a] border-gray-700">
                                    <SelectItem value="google/veo-3">Google Veo 3</SelectItem>
                                    <SelectItem value="kuaishou/kling-2.1">Kling 2.1</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Duration</Label>
                            <Select value={duration} onValueChange={(v: any) => setDuration(v)}>
                                <SelectTrigger className="bg-[#1e1e1e] border-gray-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2a2a2a] border-gray-700">
                                    <SelectItem value="5">5 Seconds</SelectItem>
                                    <SelectItem value="10">10 Seconds</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Resolution</Label>
                            <Select value={resolution} onValueChange={(v: any) => setResolution(v)}>
                                <SelectTrigger className="bg-[#1e1e1e] border-gray-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2a2a2a] border-gray-700">
                                    <SelectItem value="720p">720p</SelectItem>
                                    <SelectItem value="1080p">1080p</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Aspect Ratio</Label>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                <SelectTrigger className="bg-[#1e1e1e] border-gray-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2a2a2a] border-gray-700">
                                    <SelectItem value="16:9">16:9 Landscape</SelectItem>
                                    <SelectItem value="9:16">9:16 Portrait</SelectItem>
                                    <SelectItem value="1:1">1:1 Square</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={generating || (!prompt && !uploadedImageUrl)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold"
                    >
                        {generating ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin" />
                                Generating...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Play className="w-5 h-5" />
                                Generate Video
                            </div>
                        )}
                    </Button>

                    {generating && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>{status}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Column */}
                <div className="bg-[#2a2a2a] p-6 rounded-xl border border-gray-800 flex flex-col items-center justify-center min-h-[400px]">
                    {generatedVideoUrl ? (
                        <div className="w-full space-y-4">
                            <h3 className="text-lg font-semibold text-white">Generated Video</h3>
                            <video
                                src={generatedVideoUrl}
                                controls
                                autoPlay
                                loop
                                className="w-full rounded-lg shadow-lg border border-gray-700"
                            />
                            <Button
                                variant="outline"
                                className="w-full border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                                onClick={() => window.open(generatedVideoUrl, '_blank')}
                            >
                                Download Video
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 space-y-4">
                            <div className="w-20 h-20 bg-[#1e1e1e] rounded-full flex items-center justify-center mx-auto border border-gray-700">
                                <Film className="w-10 h-10 text-gray-600" />
                            </div>
                            <p>Your generated video will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
