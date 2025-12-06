'use client';

import { VideoGenerator } from '@/components/video/VideoGenerator';

export default function VideoPage() {
    return (
        <div className="h-full overflow-y-auto bg-[#212121]">
            <VideoGenerator />
        </div>
    );
}
