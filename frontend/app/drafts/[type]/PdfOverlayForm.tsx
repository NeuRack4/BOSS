"use client";

import React, { useEffect, useState, useRef } from "react";

export interface FieldDef {
  key: string;
  page?: number;       // 1-indexed, default 1
  top: number;         // % from page top
  left: number;        // % from page left
  width: number;       // % of page width
  height: number;      // % of page height
  placeholder?: string;
  multiline?: boolean;
}

interface PdfPage {
  dataUrl: string;
  aspectRatio: number; // height / width
}

interface Props {
  pdfUrl: string;
  fields: Record<string, string | undefined>;
  fieldDefs: FieldDef[];
  editMode: boolean;
  onChange: (key: string, value: string) => void;
  formId?: string;
}

export default function PdfOverlayForm({
  pdfUrl,
  fields,
  fieldDefs,
  editMode,
  onChange,
  formId,
}: Props) {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setPages([]);

    async function load() {
      try {
        // Dynamic import to avoid SSR
        const pdfjsLib = await import("pdfjs-dist");

        // v3: local worker (.js), avoids Next.js bundler issues with pdfjs-dist v5
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const pdfDoc = await pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        }).promise;

        const results: PdfPage[] = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (!mountedRef.current) return;

          const page = await pdfDoc.getPage(i);
          const scale = 2; // higher = sharper, heavier
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);

          // pdfjs-dist v3: use canvasContext (no canvas property)
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;

          results.push({
            dataUrl: canvas.toDataURL("image/jpeg", 0.92),
            aspectRatio: vp.height / vp.width,
          });
        }

        if (mountedRef.current) {
          setPages(results);
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => { mountedRef.current = false; };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">정부 서식 PDF 로딩 중…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
        PDF 로드 실패: {error}
      </div>
    );
  }

  return (
    <div id={formId} className="space-y-1">
      {pages.map((page, pageIdx) => {
        const pageNum = pageIdx + 1;
        const pageDefs = fieldDefs.filter((fd) => (fd.page ?? 1) === pageNum);

        return (
          <div
            key={pageIdx}
            className="relative w-full"
            style={{ paddingBottom: `${page.aspectRatio * 100}%` }}
          >
            {/* PDF background image */}
            <img
              src={page.dataUrl}
              alt={`서식 페이지 ${pageNum}`}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "fill" }}
              draggable={false}
            />

            {/* Overlay inputs / value spans */}
            {pageDefs.map((fd) => {
              const raw = fields[fd.key] ?? "";
              const isEmpty = !raw || raw === "[직접 입력]";
              const val = isEmpty ? "" : raw;

              const baseStyle: React.CSSProperties = {
                position: "absolute",
                top: `${fd.top}%`,
                left: `${fd.left}%`,
                width: `${fd.width}%`,
                height: `${fd.height}%`,
                boxSizing: "border-box",
                fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
                fontSize: "1.15vw",
                lineHeight: 1.3,
              };

              if (editMode) {
                return fd.multiline ? (
                  <textarea
                    key={fd.key}
                    value={val}
                    onChange={(e) => onChange(fd.key, e.target.value)}
                    placeholder={fd.placeholder ?? "입력"}
                    style={{
                      ...baseStyle,
                      background: "rgba(255, 252, 200, 0.88)",
                      border: "1.5px solid #f59e0b",
                      padding: "1px 3px",
                      resize: "none",
                      outline: "none",
                    }}
                  />
                ) : (
                  <input
                    key={fd.key}
                    type="text"
                    value={val}
                    onChange={(e) => onChange(fd.key, e.target.value)}
                    placeholder={fd.placeholder ?? ""}
                    style={{
                      ...baseStyle,
                      background: "rgba(255, 252, 200, 0.88)",
                      border: "1.5px solid #f59e0b",
                      padding: "1px 3px",
                      outline: "none",
                    }}
                  />
                );
              }

              // View mode — transparent overlay showing value
              return (
                <div
                  key={fd.key}
                  style={{
                    ...baseStyle,
                    display: "flex",
                    alignItems: fd.multiline ? "flex-start" : "center",
                    color: "#000",
                    padding: "1px 3px",
                    overflow: "hidden",
                    whiteSpace: fd.multiline ? "pre-wrap" : "nowrap",
                    wordBreak: "break-all",
                  }}
                >
                  {val}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
