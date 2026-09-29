import type { ComprobantePayload } from "./types";

const TIPO_DOC_CLIENTE: Record<string, string> = {
  "0": "S/D",
  "1": "DNI",
  "4": "C.EXT",
  "6": "RUC",
  "7": "PAS",
};

function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > width) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Genera el ticket de un comprobante como texto plano de ancho fijo (80mm ~48, 58mm ~32). */
export function generarTicketTexto(payload: ComprobantePayload, ancho: number = 48): string {
  const emp = payload.company;
  const linea = () => "-".repeat(ancho);
  const centrar = (txt: string) => {
    const t = txt.slice(0, ancho);
    const pad = ancho - t.length;
    const left = Math.floor(pad / 2);
    return " ".repeat(left) + t + " ".repeat(pad - left);
  };
  const fila = (izqIn: string, der: string) => {
    let izq = izqIn;
    let espacio = ancho - izq.length - der.length;
    if (espacio < 1) {
      izq = izq.slice(0, ancho - der.length - 1);
      espacio = ancho - izq.length - der.length;
    }
    return `${izq}${" ".repeat(Math.max(espacio, 0))}${der}`;
  };

  const L: string[] = [];
  L.push(centrar(emp.razonSocial ?? ""));
  if (emp.nombreComercial && emp.nombreComercial !== emp.razonSocial) {
    L.push(centrar(emp.nombreComercial));
  }
  L.push(centrar(`RUC ${emp.ruc ?? ""}`));
  const dir = emp.address?.direccion ?? "";
  if (dir) {
    for (const w of wrap(dir, ancho)) L.push(centrar(w));
  }
  L.push(linea());
  L.push(centrar(payload.tipoDoc === "01" ? "FACTURA ELECTRONICA" : "BOLETA DE VENTA ELECTRONICA"));
  L.push(centrar(`${payload.serie}-${payload.correlativo}`));
  L.push(linea());

  const cli = payload.client;
  const tdoc = TIPO_DOC_CLIENTE[String(cli.tipoDoc ?? "0")] ?? "DOC";
  L.push(fila("Cliente:", (cli.rznSocial ?? "-").slice(0, ancho - 9)));
  if (cli.numDoc && cli.numDoc !== "-") {
    L.push(fila(`${tdoc}:`, String(cli.numDoc)));
  }
  const fecha = (payload.fechaEmision ?? "").slice(0, 19).replace("T", " ");
  L.push(fila("Fecha:", fecha));
  L.push(linea());

  const moneda = payload.tipoMoneda === "PEN" ? "S/" : "$";
  for (const d of payload.details) {
    L.push(d.descripcion.slice(0, ancho));
    const cant = d.cantidad;
    const pu = d.mtoPrecioUnitario;
    const importe = cant * pu;
    const izq = `  ${cant} x ${moneda}${pu.toFixed(2)}`;
    L.push(fila(izq, `${moneda}${importe.toFixed(2)}`));
  }
  L.push(linea());

  L.push(fila("Op. Gravada:", `${moneda}${payload.mtoOperGravadas.toFixed(2)}`));
  L.push(fila("IGV (18%):", `${moneda}${payload.mtoIGV.toFixed(2)}`));
  L.push(fila("TOTAL:", `${moneda}${payload.mtoImpVenta.toFixed(2)}`));
  L.push(linea());

  const legend = payload.legends.find((l) => l.code === "1000");
  if (legend) {
    for (const w of wrap(legend.value, ancho)) L.push(w);
  }
  L.push("");
  L.push(centrar("Representacion impresa del"));
  L.push(centrar(payload.tipoDoc === "01" ? "Factura Electronica" : "Boleta de Venta Electronica"));
  L.push(centrar("Gracias por su compra"));
  L.push("");
  return L.join("\n");
}
