/**
 * 마크다운 → 스타일드 PDF 익스포터
 * ChatWindow DocumentCard + DocBox 공용
 */

export async function exportMarkdownAsPdf(markdown: string, filename: string) {
  const { marked } = await import("marked");
  const html2pdf = (await import("html2pdf.js")).default;

  marked.setOptions({ breaks: true });
  const bodyHtml = await marked(markdown);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }
      .doc-wrap {
        padding: 32px 40px;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        font-size: 13px;
        color: #1a1a1a;
        line-height: 1.8;
      }
      h1 { font-size: 20px; font-weight: 700; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #3b82f6; color: #1e3a5f; }
      h2 { font-size: 15px; font-weight: 700; margin: 20px 0 8px; color: #1e3a5f; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
      h3 { font-size: 13px; font-weight: 700; margin: 14px 0 6px; color: #374151; }
      p { margin: 6px 0; }
      ul, ol { margin: 6px 0; padding-left: 20px; }
      li { margin: 3px 0; }
      strong { font-weight: 700; color: #111; }
      hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
      blockquote { border-left: 3px solid #3b82f6; margin: 8px 0; padding: 4px 12px; background: #eff6ff; color: #374151; border-radius: 0 4px 4px 0; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
      th { background: #3b82f6; color: white; padding: 6px 10px; text-align: left; }
      td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    </style>
    <div class="doc-wrap">
      ${bodyHtml}
      <div class="footer">본 문서는 BOSS AI가 생성한 초안입니다. 실제 사용 전 내용을 검토하시기 바랍니다.</div>
    </div>
  `;

  await html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `${filename}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(wrapper)
    .save();
}
