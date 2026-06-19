import { Buffer } from "node:buffer";
import { inflateSync, deflateSync } from "node:zlib";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Producto } from "@/lib/types";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 40;
const TITLE_Y = PAGE_HEIGHT - 56;
const TABLE_HEADER_Y = PAGE_HEIGHT - 132;
const TABLE_ROW_TOP = PAGE_HEIGHT - 170;
const ROW_HEIGHT = 24;
const ROWS_PER_PAGE = 15;
const NAME_X = 56;
const CODE_X = 390;
const QTY_X = 710;
const LOGO_X = 40;
const LOGO_Y = PAGE_HEIGHT - 74;
const LOGO_WIDTH = 170;
const LOGO_HEIGHT = 42;

type LogoImage = {
  width: number;
  height: number;
  data: Buffer;
};

function sanitizePdfText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function textLine(x: number, y: number, size: number, text: string) {
  return `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${sanitizePdfText(text)}) Tj ET`;
}

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(pngBuffer: Buffer): LogoImage {
  const signature = pngBuffer.subarray(0, 8);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (!signature.equals(pngSignature)) {
    throw new Error("El archivo no es un PNG valido.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Buffer[] = [];

  while (offset < pngBuffer.length) {
    const length = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = pngBuffer.subarray(dataStart, dataEnd);
    offset = dataEnd + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === "IDAT") {
      idatParts.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error("El PNG debe ser de 8 bits y sin interlace.");
  }

  const bytesPerPixel = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 0;
  if (!bytesPerPixel) {
    throw new Error("Tipo de color PNG no soportado.");
  }

  const inflated = inflateSync(Buffer.concat(idatParts));
  const rowLength = width * bytesPerPixel;
  const stride = rowLength + 1;
  const expectedLength = stride * height;

  if (inflated.length < expectedLength) {
    throw new Error("El PNG esta incompleto.");
  }

  const recon = Buffer.alloc(width * height * bytesPerPixel);
  const previousRow = Buffer.alloc(rowLength);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated.readUInt8(inputOffset);
    inputOffset += 1;
    const row = inflated.subarray(inputOffset, inputOffset + rowLength);
    inputOffset += rowLength;
    const outputRow = recon.subarray(y * rowLength, (y + 1) * rowLength);

    for (let x = 0; x < rowLength; x += 1) {
      const raw = row[x];
      const left = x >= bytesPerPixel ? outputRow[x - bytesPerPixel] : 0;
      const up = previousRow[x];
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] : 0;

      switch (filter) {
        case 0:
          outputRow[x] = raw;
          break;
        case 1:
          outputRow[x] = (raw + left) & 0xff;
          break;
        case 2:
          outputRow[x] = (raw + up) & 0xff;
          break;
        case 3:
          outputRow[x] = (raw + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          outputRow[x] = (raw + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error("Filtro PNG no soportado.");
      }
    }

    outputRow.copy(previousRow);
  }

  const rgb = Buffer.alloc(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceIndex = pixel * bytesPerPixel;
    const targetIndex = pixel * 3;

    if (colorType === 6) {
      const alpha = recon[sourceIndex + 3] / 255;
      rgb[targetIndex] = Math.round(recon[sourceIndex] * alpha + 255 * (1 - alpha));
      rgb[targetIndex + 1] = Math.round(recon[sourceIndex + 1] * alpha + 255 * (1 - alpha));
      rgb[targetIndex + 2] = Math.round(recon[sourceIndex + 2] * alpha + 255 * (1 - alpha));
      continue;
    }

    if (colorType === 2) {
      rgb[targetIndex] = recon[sourceIndex];
      rgb[targetIndex + 1] = recon[sourceIndex + 1];
      rgb[targetIndex + 2] = recon[sourceIndex + 2];
      continue;
    }

    const gray = recon[sourceIndex];
    rgb[targetIndex] = gray;
    rgb[targetIndex + 1] = gray;
    rgb[targetIndex + 2] = gray;
  }

  return {
    width,
    height,
    data: rgb,
  };
}

function buildImageObject(logoImage: LogoImage | null, imageObjectNumber: number | null) {
  if (!logoImage || imageObjectNumber === null) {
    return null;
  }

  const compressed = deflateSync(logoImage.data);
  return Buffer.concat([
    Buffer.from(
      `${imageObjectNumber} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
      "latin1"
    ),
    compressed,
    Buffer.from(`\nendstream\nendobj\n`, "latin1"),
  ]);
}

function buildPageContent(
  products: Producto[],
  pageNumber: number,
  totalPages: number,
  includeLogo: boolean
) {
  const lines: string[] = [];
  const todayText = new Intl.DateTimeFormat("es-AR").format(new Date());

  lines.push("0.96 0.98 0.97 rg");
  lines.push(`${MARGIN} ${PAGE_HEIGHT - 78} ${PAGE_WIDTH - MARGIN * 2} 48 re f`);

  if (includeLogo) {
    lines.push(`q ${LOGO_WIDTH} 0 0 ${LOGO_HEIGHT} ${LOGO_X} ${LOGO_Y} cm /Logo Do Q`);
  }

  lines.push("0 0 0 rg");
  lines.push(textLine(PAGE_WIDTH - 180, TITLE_Y, 10, `Fecha: ${todayText}`));

  lines.push("0.90 0.93 0.91 rg");
  lines.push(`${MARGIN} ${TABLE_HEADER_Y} ${PAGE_WIDTH - MARGIN * 2} 30 re f`);
  lines.push("0.66 0.72 0.69 RG");
  lines.push(`${MARGIN} ${TABLE_HEADER_Y} ${PAGE_WIDTH - MARGIN * 2} 30 re S`);
  lines.push("0 0 0 rg");
  lines.push(textLine(NAME_X, TABLE_HEADER_Y + 11, 11, "Modelo"));
  lines.push(textLine(CODE_X, TABLE_HEADER_Y + 11, 11, "Codigo"));
  lines.push(textLine(QTY_X, TABLE_HEADER_Y + 11, 11, "Cantidad"));

  if (products.length === 0) {
    lines.push(textLine(NAME_X, TABLE_ROW_TOP, 12, "Sin productos para mostrar."));
  } else {
    products.forEach((product, index) => {
      const rowTop = TABLE_ROW_TOP - index * ROW_HEIGHT;
      const rowBottom = rowTop - ROW_HEIGHT + 2;

      if (index % 2 === 0) {
        lines.push("0.98 0.99 0.98 rg");
        lines.push(`${MARGIN} ${rowBottom} ${PAGE_WIDTH - MARGIN * 2} ${ROW_HEIGHT - 2} re f`);
      }

      lines.push("0.90 0.93 0.91 RG");
      lines.push(`${MARGIN} ${rowBottom} ${PAGE_WIDTH - MARGIN * 2} ${ROW_HEIGHT - 2} re S`);
      lines.push("0 0 0 rg");
      lines.push(textLine(NAME_X, rowBottom + 7, 11, truncateText(product.name, 32)));
      lines.push(textLine(CODE_X, rowBottom + 7, 11, truncateText(product.code, 18)));
      lines.push(textLine(QTY_X, rowBottom + 7, 11, String(product.quantity)));
    });
  }

  lines.push(textLine(MARGIN, 22, 9, `Pagina ${pageNumber} de ${totalPages}`));
  return lines.join("\n");
}

function buildPdfFromPages(pages: string[], logoImage: LogoImage | null) {
  const pageCount = pages.length;
  const hasLogo = Boolean(logoImage);
  const imageObjectNumber = hasLogo ? 4 : null;
  const contentStart = hasLogo ? 5 : 4;
  const pageStart = contentStart + pageCount;
  const contentObjectNumbers = pages.map((_, index) => contentStart + index);
  const pageObjectNumbers = pages.map((_, index) => pageStart + index);
  const objects: Buffer[] = [];

  objects.push(Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`, "latin1"));
  objects.push(
    Buffer.from(
      `2 0 obj\n<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`,
      "latin1"
    )
  );
  objects.push(Buffer.from(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`, "latin1"));

  if (hasLogo && imageObjectNumber !== null) {
    const imageObject = buildImageObject(logoImage, imageObjectNumber);
    if (imageObject) {
      objects.push(imageObject);
    }
  }

  pages.forEach((content, index) => {
    const contentNumber = contentObjectNumbers[index];
    const contentLength = Buffer.byteLength(content, "latin1");
    objects.push(
      Buffer.from(
        `${contentNumber} 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`,
        "latin1"
      )
    );
  });

  pages.forEach((_, index) => {
    const pageNumber = pageObjectNumbers[index];
    const contentNumber = contentObjectNumbers[index];
    const xObjectEntry = hasLogo && imageObjectNumber !== null ? ` /XObject << /Logo ${imageObjectNumber} 0 R >>` : "";
    objects.push(
      Buffer.from(
        `${pageNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >>${xObjectEntry} >> /Contents ${contentNumber} 0 R >>\nendobj\n`,
        "latin1"
      )
    );
  });

  const header = "%PDF-1.4\n";
  const chunks: Buffer[] = [Buffer.from(header, "latin1")];
  const offsets: number[] = [0];
  let offset = Buffer.byteLength(header, "latin1");

  objects.forEach((object) => {
    offsets.push(offset);
    const buffer = Buffer.concat([object, Buffer.from("\n", "latin1")]);
    chunks.push(buffer);
    offset += buffer.length;
  });

  const xrefStart = offset;
  const xrefEntries = [`0000000000 65535 f `];
  for (let index = 1; index < offsets.length; index += 1) {
    xrefEntries.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    `xref`,
    `0 ${objects.length + 1}`,
    ...xrefEntries,
    `trailer << /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref`,
    String(xrefStart),
    `%%EOF`,
  ].join("\n");

  chunks.push(Buffer.from(`${trailer}\n`, "latin1"));
  return Buffer.concat(chunks);
}

async function fetchLogo() {
  try {
    const response = await fetch("https://nexer.neocities.org/logoinverso.png", {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return decodePng(Buffer.from(arrayBuffer));
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = getSupabaseServerClient();

  const orderedResponse = await supabase
    .from("products")
    .select("id, name, code, quantity, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  let products: Producto[] = [];

  if (!orderedResponse.error && orderedResponse.data) {
    products = orderedResponse.data as Producto[];
  } else {
    const fallbackResponse = await supabase
      .from("products")
      .select("id, name, code, quantity, created_at")
      .order("created_at", { ascending: true });

    if (fallbackResponse.data) {
      products = fallbackResponse.data.map((producto, index) => ({
        ...producto,
        sort_order: index,
      })) as Producto[];
    }
  }

  const logoImage = await fetchLogo();
  const pages: string[] = [];

  if (products.length === 0) {
    pages.push(buildPageContent([], 1, 1, Boolean(logoImage)));
  } else {
    for (let index = 0; index < products.length; index += ROWS_PER_PAGE) {
      const pageProducts = products.slice(index, index + ROWS_PER_PAGE);
      const pageNumber = Math.floor(index / ROWS_PER_PAGE) + 1;
      const totalPages = Math.ceil(products.length / ROWS_PER_PAGE);
      pages.push(buildPageContent(pageProducts, pageNumber, totalPages, Boolean(logoImage)));
    }
  }

  const pdf = buildPdfFromPages(pages, logoImage);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `Inventario Insumos ${dateStamp}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "no-store",
    },
  });
}
