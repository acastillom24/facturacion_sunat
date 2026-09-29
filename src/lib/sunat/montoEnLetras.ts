const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DECENAS = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS",
  "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
];
const DECENAS_D = [
  "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA",
  "SETENTA", "OCHENTA", "NOVENTA",
];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS",
  "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function tresDigitos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let out = CENTENAS[c];
  if (r) {
    if (r < 10) {
      out += (out ? " " : "") + UNIDADES[r];
    } else if (r < 20) {
      out += (out ? " " : "") + DECENAS[r - 10];
    } else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (d === 2 && u) {
        out += (out ? " " : "") + "VEINTI" + UNIDADES[u];
      } else {
        out += (out ? " " : "") + DECENAS_D[d];
        if (u) out += " Y " + UNIDADES[u];
      }
    }
  }
  return out.trim();
}

/** Convierte un monto a su representación en letras (español, soles/dólares). */
export function montoEnLetras(monto: number, moneda: string = "PEN"): string {
  const entero = Math.trunc(monto);
  const centimos = Math.round((monto - entero) * 100);

  let palabras: string;
  if (entero === 0) {
    palabras = "CERO";
  } else {
    const millones = Math.floor(entero / 1_000_000);
    const resto = entero % 1_000_000;
    const miles = Math.floor(resto / 1000);
    const cientos = resto % 1000;
    const partes: string[] = [];
    if (millones) {
      partes.push(millones === 1 ? "UN MILLON" : `${tresDigitos(millones)} MILLONES`);
    }
    if (miles) {
      partes.push(miles === 1 ? "MIL" : `${tresDigitos(miles)} MIL`);
    }
    if (cientos) {
      partes.push(tresDigitos(cientos));
    }
    palabras = partes.join(" ");
  }

  const nombreMoneda = moneda === "PEN" ? "SOLES" : "DOLARES AMERICANOS";
  const centimosStr = String(centimos).padStart(2, "0");
  return `SON ${palabras} CON ${centimosStr}/100 ${nombreMoneda}`;
}
