export type TipoDoc = "01" | "03"; // 01 = factura, 03 = boleta

export interface EmpresaAddress {
  ubigueo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  direccion: string;
  codLocal: string;
}

export interface EmpresaSunat {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  address: EmpresaAddress;
}

export interface ClienteSunat {
  tipoDoc: string; // 0 sin doc, 1 DNI, 6 RUC, 4 carnet ext, 7 pasaporte
  numDoc: string;
  rznSocial: string;
}

export interface ItemInput {
  descripcion: string;
  cantidad: number;
  precioUnitario: number; // precio final CON IGV
  unidad?: string;
  codigo?: string;
}

export interface DetalleSunat {
  codProducto: string;
  unidad: string;
  descripcion: string;
  cantidad: number;
  mtoValorUnitario: number;
  mtoValorVenta: number;
  mtoBaseIgv: number;
  porcentajeIgv: number;
  igv: number;
  tipAfeIgv: string;
  totalImpuestos: number;
  mtoPrecioUnitario: number;
}

export interface ComprobantePayload {
  ublVersion: string;
  tipoOperacion: string;
  tipoDoc: TipoDoc;
  serie: string;
  correlativo: string;
  fechaEmision: string;
  formaPago: { moneda: string; tipo: string };
  tipoMoneda: string;
  client: ClienteSunat;
  company: EmpresaSunat;
  mtoOperGravadas: number;
  mtoIGV: number;
  valorVenta: number;
  totalImpuestos: number;
  subTotal: number;
  mtoImpVenta: number;
  details: DetalleSunat[];
  legends: { code: string; value: string }[];
}

export interface SunatCdrResponse {
  success?: boolean;
  cdrResponse?: Record<string, unknown>;
  error?: { code?: string; message?: string };
  ticket?: string;
}

export interface InvoiceSendResponse {
  sunatResponse?: SunatCdrResponse;
  xml?: string;
  hash?: string;
  [key: string]: unknown;
}
