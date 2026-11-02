import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * SafeChartContainer
 *
 * Mencegah warning Recharts: "The width(0) and height(0) of chart should be greater than 0".
 * Menjamin ResponsiveContainer dan PieChart/AreaChart/BarChart/RadarChart hanya dirender
 * ketika parent container memiliki dimensi positif (width > 0 dan height > 0).
 *
 * Karakteristik:
 * 1. Menggunakan ResizeObserver untuk mendeteksi perubahan ukuran layar (desktop/mobile),
 *    perpindahan tab, dan pembukaan modal secara responsif.
 * 2. Menyediakan placeholder visual sementara saat container belum memiliki dimensi terukur.
 * 3. Mengatur min-height dan min-width eksplisit pada parent container.
 * 4. Mendukung overlay centerContent untuk Donut PieChart.
 */
export default function SafeChartContainer({
  children,
  minHeight = 160,
  minWidth = 100,
  height = '100%',
  width = '100%',
  className = 'w-full h-full relative',
  style = {},
  fallback = null,
  centerContent = null,
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let isMounted = true;

    const measureDimensions = () => {
      if (!isMounted || !element) return;
      const rect = element.getBoundingClientRect();
      const currentWidth = Math.round(rect.width || element.clientWidth || 0);
      const currentHeight = Math.round(rect.height || element.clientHeight || 0);

      if (currentWidth > 0 && currentHeight > 0) {
        setDimensions({ width: currentWidth, height: currentHeight });
        setIsReady(true);
      }
    };

    // Pengukuran awal
    measureDimensions();

    // ResizeObserver untuk responsivitas viewport, tab switch, dan modal
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        if (!isMounted) return;
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            setDimensions({ width: Math.round(w), height: Math.round(h) });
            setIsReady(true);
          }
        }
      });
      resizeObserver.observe(element);
    } else {
      window.addEventListener('resize', measureDimensions);
    }

    // Double-check setelah pass render/layout pertama via requestAnimationFrame
    const rafId = requestAnimationFrame(measureDimensions);

    return () => {
      isMounted = false;
      cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', measureDimensions);
      }
    };
  }, []);

  const hasValidDimensions = isReady && dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{
        minHeight: `${minHeight}px`,
        minWidth: `${minWidth}px`,
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    >
      {hasValidDimensions ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={minWidth}
          minHeight={minHeight}
          debounce={50}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        fallback || (
          <div
            className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200/60 dark:border-white/10"
            style={{ minHeight: `${minHeight}px` }}
          >
            <div className="flex flex-col items-center justify-center p-3 text-center space-y-1.5">
              <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-[#C89D32] rounded-full animate-spin" />
              <span className="text-[10px] text-slate-400 font-medium">Memuat grafik responsif...</span>
            </div>
          </div>
        )
      )}

      {/* Konten overlay tengah untuk Donut Chart (misal teks ringkasan omset/pelunasan) */}
      {hasValidDimensions && centerContent}
    </div>
  );
}
