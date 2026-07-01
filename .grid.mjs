import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFileSync, writeFileSync } from "node:fs";
const [,, inp, outp] = process.argv;
const doc = await PDFDocument.load(readFileSync(inp));
const page = doc.getPage(0); const H = page.getHeight(), Wd = page.getWidth();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let y=50;y<H;y+=50){ page.drawLine({start:{x:0,y:H-y},end:{x:Wd,y:H-y},thickness:0.3,color:rgb(1,0.4,0.4)});
  page.drawText(String(y),{x:2,y:H-y+1,size:6,font,color:rgb(1,0,0)}); page.drawText(String(y),{x:Wd-18,y:H-y+1,size:6,font,color:rgb(1,0,0)}); }
for (let x=50;x<Wd;x+=50){ page.drawLine({start:{x,y:H},end:{x,y:0},thickness:0.3,color:rgb(0.4,0.6,1)});
  page.drawText(String(x),{x:x+1,y:H-10,size:6,font,color:rgb(0,0,1)}); }
writeFileSync(outp, await doc.save());
