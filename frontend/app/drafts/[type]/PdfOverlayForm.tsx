"use client";

import React, { useEffect, useState, useRef } from "react";
import Script from "next/script";

export interface FieldDef {
  key: string;
  page?: number; // 1-indexed, default 1
  top: number; // % from page top
  left: number; // % from page left
  width: number; // % of page width
  height: number; // % of page height
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

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const CMAP_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`;

// pdfjsLib is injected into window by the CDN script tag
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

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
  // Track whether the CDN script has been loaded
  const [scriptReady, setScriptReady] = useState(false);

  // If window.pdfjsLib is already present (e.g. back-navigation), mark ready immediately
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as Window & { pdfjsLib?: PdfjsLib }).pdfjsLib
    ) {
      setScriptReady(true);
    }
  }, []);

  // Render PDF pages once script is ready
  useEffect(() => {
    if (!scriptReady) return;

    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setPages([]);

    async function load() {
      try {
        const pdfjsLib: PdfjsLib = (window as Window & { pdfjsLib?: PdfjsLib })
          .pdfjsLib;
        if (!pdfjsLib)
          throw new Error("pdf.js 라이브러리를 불러올 수 없습니다.");

        // Worker loaded from CDN — no webpack/bundler interference
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;

        const pdfDoc = await pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: CMAP_URL,
          cMapPacked: true,
        }).promise;

        const results: PdfPage[] = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          if (!mountedRef.current) return;

          const page = await pdfDoc.getPage(i);
          const scale = 2;
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(vp.width);
          canvas.height = Math.round(vp.height);

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
    return () => {
      mountedRef.current = false;
    };
  }, [pdfUrl, scriptReady]);

  return (
    <>
      {/* Load pdfjs from CDN — fully bypasses webpack UMD module conflict */}
      <Script
        src={PDFJS_CDN}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setError("pdf.js CDN 로드 실패 — 네트워크를 확인해주세요.");
          setLoading(false);
        }}
      />

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">정부 서식 PDF 로딩 중…</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          PDF 로드 실패: {error}
        </div>
      )}

      {!loading && !error && (
        <div id={formId} className="space-y-1">
          {pages.map((page, pageIdx) => {
            const pageNum = pageIdx + 1;
            const pageDefs = fieldDefs.filter(
              (fd) => (fd.page ?? 1) === pageNum,
            );

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
                    fontFamily:
                      "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
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
      )}
    </>
  );
}
