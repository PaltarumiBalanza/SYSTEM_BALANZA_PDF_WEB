'use client';

import { useEffect, useRef } from 'react';

interface PdfPageCanvasProps {
    pdfData: ArrayBuffer;
    pageIndex: number; // 1-based
    width?: number;
}

export function PdfPageCanvas({ pdfData, pageIndex, width = 200 }: PdfPageCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let cancelled = false;

        async function render() {
            if (!canvasRef.current) return;

            // Dynamically import to avoid SSR issues
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

            // Clone ArrayBuffer for each read since it may be consumed
            const copy = pdfData.slice(0);
            const loadingTask = pdfjsLib.getDocument({ data: copy });
            const pdf = await loadingTask.promise;

            if (cancelled) return;

            const page = await pdf.getPage(pageIndex);
            if (cancelled) return;

            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = width / unscaledViewport.width;
            const viewport = page.getViewport({ scale });

            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }

        render().catch(console.error);

        return () => { cancelled = true; };
    }, [pdfData, pageIndex, width]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: '2px',
                display: 'block',
            }}
        />
    );
}
