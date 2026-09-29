import ExcelJS from "exceljs";

/**
 * Columnas de la plantilla de carga masiva. El orden es el que se usa al
 * generar la plantilla; al leer un archivo subido se busca cada columna por
 * su encabezado (no por posición), así que el usuario puede reordenarlas.
 */
export const COLUMNAS_CARGA = [
  { header: "Grupo", key: "grupo", width: 10 },
  { header: "Tipo (B/F)", key: "tipo", width: 12 },
  { header: "Serie", key: "serie", width: 10 },
  { header: "Documento Cliente", key: "documento", width: 20 },
  { header: "Nombre Cliente", key: "nombre", width: 28 },
  { header: "Descripcion", key: "descripcion", width: 32 },
  { header: "Cantidad", key: "cantidad", width: 10 },
  { header: "Precio Unitario (con IGV)", key: "precioUnitario", width: 22 },
  { header: "Codigo", key: "codigo", width: 12 },
  { header: "Moneda (PEN/USD)", key: "moneda", width: 16 },
  { header: "Forma de Pago (Contado/Credito)", key: "formaPago", width: 24 },
] as const;

export type ClaveColumnaCarga = (typeof COLUMNAS_CARGA)[number]["key"];

export async function generarPlantillaCargaMasiva(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Comprobantes");
  hoja.columns = COLUMNAS_CARGA.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  hoja.getRow(1).font = { bold: true };

  // Grupo 1: una sola boleta con DOS ítems (dos filas, mismo número de Grupo).
  // Tipo/Serie/Documento/Nombre solo se leen de la PRIMERA fila del grupo.
  hoja.addRow({
    grupo: 1,
    tipo: "B",
    serie: "B001",
    documento: "",
    nombre: "",
    descripcion: "Servicio de ejemplo A",
    cantidad: 1,
    precioUnitario: 100,
    codigo: "",
    moneda: "PEN",
    formaPago: "Contado",
  });
  hoja.addRow({
    grupo: 1,
    descripcion: "Servicio de ejemplo B",
    cantidad: 2,
    precioUnitario: 25,
  });
  // Grupo 2: una factura con un solo ítem (sin filas adicionales).
  hoja.addRow({
    grupo: 2,
    tipo: "F",
    serie: "F001",
    documento: "20613818171",
    nombre: "ACME SAC",
    descripcion: "Producto de ejemplo",
    cantidad: 2,
    precioUnitario: 59.9,
    codigo: "PRD001",
    moneda: "PEN",
    formaPago: "Contado",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface FilaCargaCruda {
  fila: number; // número de fila en el Excel (1-based, incluye encabezado)
  valores: Partial<Record<ClaveColumnaCarga, string>>;
}

function normalizarEncabezado(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

const PALABRAS_CLAVE: Record<ClaveColumnaCarga, string> = {
  grupo: "grupo",
  tipo: "tipo",
  serie: "serie",
  documento: "documento",
  nombre: "nombre",
  descripcion: "descrip",
  cantidad: "cantidad",
  precioUnitario: "precio",
  codigo: "codigo",
  moneda: "moneda",
  formaPago: "pago",
};

export async function leerFilasCargaMasiva(buffer: ArrayBuffer): Promise<FilaCargaCruda[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const hoja = workbook.worksheets[0];
  if (!hoja) return [];

  const headerRow = hoja.getRow(1);
  const columnaPorIndice = new Map<number, ClaveColumnaCarga>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const texto = normalizarEncabezado(String(cell.value ?? ""));
    for (const [key, palabra] of Object.entries(PALABRAS_CLAVE) as [ClaveColumnaCarga, string][]) {
      if (texto.includes(palabra)) {
        columnaPorIndice.set(colNumber, key);
        break;
      }
    }
  });

  const filas: FilaCargaCruda[] = [];
  hoja.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const valores: Partial<Record<ClaveColumnaCarga, string>> = {};
    let tieneAlgo = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = columnaPorIndice.get(colNumber);
      if (!key) return;
      const valor = cell.value;
      const texto = valor === null || valor === undefined ? "" : String(valor).trim();
      if (texto) tieneAlgo = true;
      valores[key] = texto;
    });
    if (tieneAlgo) filas.push({ fila: rowNumber, valores });
  });

  return filas;
}
