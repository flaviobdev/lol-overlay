/* Aplica assets/icon.ico como ícone do lol-overlay.exe (o pkg não define ícone
   do executável). Best-effort: se o rcedit não estiver disponível, o build
   segue com o exe sem ícone customizado. Roda nativo no Windows. */
const path = require("path");
const fs = require("fs");

const exe = path.join(__dirname, "..", "lol-overlay.exe");
const icon = path.join(__dirname, "..", "assets", "icon.ico");

if (!fs.existsSync(exe)) {
  console.warn("set-exe-icon: lol-overlay.exe não encontrado, pulando.");
  process.exit(0);
}

let rcedit;
try {
  rcedit = require("rcedit");
} catch {
  console.warn("set-exe-icon: rcedit ausente — exe sem ícone customizado.");
  process.exit(0);
}

rcedit(exe, { icon })
  .then(() => console.log("set-exe-icon: ícone aplicado ao lol-overlay.exe"))
  .catch((e) => {
    console.warn("set-exe-icon: falhou (" + e.message + ") — exe sem ícone.");
    process.exit(0); // não quebra o build
  });
