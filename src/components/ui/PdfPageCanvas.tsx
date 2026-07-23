'use client';

import { useEffect, useRef } from 'react';

interface PdfPageCanvasProps {
    pdfDoc: any;       // Instancia del documento PDF de pdfjs
    pageIndex: number; // 1-based
    width?: number;
}

export function PdfPageCanvas({ pdfDoc, pageIndex, width = 200 }: PdfPageCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let cancelled = false;

        async function render() {
            if (!canvasRef.current || !pdfDoc) return;

            // Obtener la página del documento parseado previamente
            const page = await pdfDoc.getPage(pageIndex);
            if (cancelled) return;

            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = width / unscaledViewport.width;

            // Usar factor de escala incrementado por el pixel ratio del dispositivo para máxima nitidez (High-DPI / Retina)
            const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1.5 : 1.5;
            const viewport = page.getViewport({ scale: scale * dpr });

            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Dimensiones internas de alta resolución
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Ajustar escala interna del contexto para dibujar a tamaño virtual original
            ctx.resetTransform();

            // Renderizar la página del PDF en el lienzo canvas
            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }

        render().catch(console.error);

        return () => { cancelled = true; };
    }, [pdfDoc, pageIndex, width]);

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
