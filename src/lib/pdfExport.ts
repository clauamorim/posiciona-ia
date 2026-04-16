import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const SECTION_GAP_MM = 4;

/**
 * Section-based PDF export: captures each [data-pdf-section] element
 * individually and stacks them onto A4 pages with proper page breaks.
 */
export async function exportSectionBasedPDF(
  container: HTMLElement,
  filename: string,
  bgColor = "#FAF8F5"
): Promise<void> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let currentY = MARGIN_MM;

  const sections = Array.from(
    container.querySelectorAll("[data-pdf-section]")
  ) as HTMLElement[];

  if (sections.length === 0) {
    // Fallback: capture entire container as one big section
    sections.push(container);
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Hide elements marked for PDF exclusion
    const hidden = section.querySelectorAll("[data-hide-pdf]");
    hidden.forEach((el) => (el as HTMLElement).style.display = "none");

    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
      windowWidth: 900, // consistent width for rendering
    });

    hidden.forEach((el) => (el as HTMLElement).style.display = "");

    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const scaleFactor = CONTENT_WIDTH_MM / widthPx;
    const heightMM = heightPx * scaleFactor;

    const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

    if (heightMM > remainingSpace && currentY > MARGIN_MM) {
      pdf.addPage();
      currentY = MARGIN_MM;
    }

    // If section is taller than a full page, split it across pages
    if (heightMM > A4_HEIGHT_MM - MARGIN_MM * 2) {
      const pageContentHeight = A4_HEIGHT_MM - MARGIN_MM * 2;
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      let srcY = 0;
      const totalHeight = heightMM;

      while (srcY < totalHeight) {
        if (srcY > 0) {
          pdf.addPage();
          currentY = MARGIN_MM;
        }
        const sliceHeight = Math.min(pageContentHeight, totalHeight - srcY);
        // Use clip by adjusting source coordinates
        pdf.addImage(
          imgData, "JPEG",
          MARGIN_MM, currentY - (srcY * CONTENT_WIDTH_MM / widthPx * (widthPx / CONTENT_WIDTH_MM)),
          CONTENT_WIDTH_MM, totalHeight,
          undefined, "FAST"
        );
        // Mask with white rectangles above and below
        if (srcY > 0) {
          pdf.setFillColor(bgColor);
          pdf.rect(0, 0, A4_WIDTH_MM, MARGIN_MM, "F");
        }
        srcY += sliceHeight;
        currentY = MARGIN_MM + sliceHeight;
      }
    } else {
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(imgData, "JPEG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);
      currentY += heightMM + SECTION_GAP_MM;
    }
  }

  pdf.save(filename);
}
