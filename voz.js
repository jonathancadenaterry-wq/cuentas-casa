/* Cuentas de la casa — entiende frases dichas en español y las convierte en un gasto,
   un ingreso o un registro de predicación. Todo se calcula en el celular, sin internet.
   Ejemplos: "gasté 15 con 50 en compras", "ayer pagué 20 en la farmacia",
   "prediqué dos horas y media con tres revisitas". */
(function(raiz){
'use strict';

const UNI = {cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,
  once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,
  veintiun:21,veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,
  veintisiete:27,veintiocho:28,veintinueve:29};
const DEC = {treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90};
const CEN = {cien:100,ciento:100,doscientos:200,doscientas:200,trescientos:300,trescientas:300,cuatrocientos:400,
  cuatrocientas:400,quinientos:500,quinientas:500,seiscientos:600,seiscientas:600,setecientos:700,setecientas:700,
  ochocientos:800,ochocientas:800,novecientos:900,novecientas:900};
const MESES = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
const DIAS = {domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};

// Palabras clave → categoría. El orden importa: lo más específico primero, "compras" al final.
const CAT_GASTO = [
  ['spa', /\b(spa|sparati)\b/],
  ['salud', /\b(farmacia|medicinas?|medicamentos?|pastillas?|remedios?|doctor|doctora|medico|medica|consulta|clinica|hospital|dentista|odontologo|examenes)\b/],
  ['servicios', /\b(luz|agua|internet|planilla|telefono|plan|recarga|saldo|cable|wifi)\b/],
  ['transporte', /\b(pasajes?|bus|buses|taxi|gasolina|combustible|diesel|transporte|moto|mototaxi|carro|camioneta|ranchera|flete|peaje)\b/],
  ['educacion', /\b(escuela|colegio|utiles|universidad|estudios|matricula|pension|copias|impresiones)\b/],
  ['ropa', /\b(ropa|zapatos?|zapatillas|camisa|pantalon|vestido|blusa|uniforme)\b/],
  ['deudas', /\b(deudas?|cuotas?|tarjeta|abono|letra)\b/],
  ['casa', /\b(casa|arriendo|alquiler|ferreteria|limpieza|detergente|gas|tanque|muebles?|cocina)\b/],
  ['gustos', /\b(helados?|cine|paseo|salida|regalos?|gustos?|cumpleanos|fiesta)\b/],
  ['trabajo', /\b(trabajo|oficina)\b/],
  ['comida', /\b(compras?|comida|comidas|mercado|supermercado|super|tienda|viveres|almuerzos?|desayunos?|meriendas?|cenas?|pan|frutas?|verduras?|carne|pollo|pescado|arroz|restaurante|comedor|encebollado|ceviche|salchipapas?|hamburguesas?|pizza|snacks?|golosinas)\b/]
];
const CAT_INGRESO = [
  ['negocio', /\b(spa|sparati|negocio|clientas?|clientes?)\b/],
  ['sueldo', /\b(sueldo|salario|quincena|rol|pago del ministerio)\b/],
  ['ventas', /\b(ventas?|vendi|vendimos|vendio)\b/],
  ['prestamo', /\b(prestamo|prestaron|presto)\b/]
];
const RX_PRED = /\b(predic\w*|ministerio|servicio del campo|revisitas?|precursor\w*)\b/;
const RX_INGRESO = /\b(cobre|cobramos|cobro|recibi|recibimos|me pagaron|nos pagaron|le pagaron|sueldo|salario|quincena|ingreso|ingresaron|gane|ganamos|vendi|vendimos|me dieron|nos dieron)\b/;
const RX_GASTO = /\b(gaste|gastamos|gasto|pague|pagamos|compre|compramos|costo|salio|cuesta|pagar|comprar|gastar)\b/;
const RX_DINERO = /\b(dolares|dolar|usd|centavos?)\b/;
const RX_PREVISTO = /\b(falta|faltan|tengo que|tenemos que|hay que|debo|debemos|voy a|vamos a|por pagar|por cobrar|toca pagar|toca cobrar)\b/;

const pad = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const mayus = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;

function palabrasANumeros(t){
  const tk = t.split(' ').filter(Boolean), out = [];
  const esNum = w => (w in UNI) || (w in DEC) || (w in CEN) || w==='mil';
  let i = 0;
  while(i < tk.length){
    if(!esNum(tk[i])){ out.push(tk[i]); i++; continue; }
    let total = 0, cur = 0, j = i;
    while(j < tk.length){
      const w = tk[j];
      if(w in CEN){ cur += CEN[w]; j++; continue; }
      if(w in DEC || w==='veinte'){
        cur += (w in DEC) ? DEC[w] : 20; j++;
        if(tk[j]==='y' && (tk[j+1] in UNI) && UNI[tk[j+1]]<10){ cur += UNI[tk[j+1]]; j += 2; }
        continue;
      }
      if(w in UNI){ cur += UNI[w]; j++;
        if(tk[j] in UNI || tk[j] in DEC) break;   // "dos tres" no se suma
        continue; }
      if(w==='mil'){ total += (cur||1)*1000; cur = 0; j++; continue; }
      break;
    }
    out.push(String(total+cur)); i = j;
  }
  return out.join(' ');
}

function normalizar(texto){
  let t = String(texto||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  t = t.replace(/\$\s*(\d+(?:[.,]\d{1,2})?)/g,' $1 dolares ').replace(/(\d)\s*\$/g,'$1 dolares ');
  t = t.replace(/(\d)[.,](\d{3})(?!\d)/g,'$1$2');            // 1.200 → 1200
  t = t.replace(/[^a-z0-9.,\s]/g,' ').replace(/[.,](?!\d)/g,' ').replace(/(^|\s)[.,]/g,' ');
  t = t.replace(/\s+/g,' ').trim();
  t = palabrasANumeros(t);
  return ' '+t.replace(/\s+/g,' ').trim()+' ';
}
const num = s => parseFloat(String(s).replace(',','.'));

function interpretar(texto, op){
  op = op || {};
  const hoy = op.hoy ? new Date(op.hoy) : new Date();
  hoy.setHours(12,0,0,0);
  const t = normalizar(texto);
  const r = {texto:String(texto||'').trim(), tipo:null, monto:null, cat:null, nota:'', fecha:iso(hoy), fechaDicha:false,
             estado:'hecho', min:null, rev:null};
  let resto = t;
  const quitar = m => { resto = resto.replace(m, ' '); };
  const previsto = RX_PREVISTO.test(t);

  // ---- Fecha ----
  let m, f = null;
  if((m = resto.match(/\s(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\s/))){
    const d = +m[1], mes = MESES[m[2]];
    let y = m[3] ? +m[3] : hoy.getFullYear();
    if(!m[3] && mes > hoy.getMonth()+1 && !previsto) y--;
    f = new Date(y, mes-1, d, 12); quitar(m[0]);
  } else if((m = resto.match(/\s(anteayer|antier|antes de ayer)\s/))){ f = new Date(hoy); f.setDate(f.getDate()-2); quitar(m[0]); }
  else if((m = resto.match(/\sayer\s/))){ f = new Date(hoy); f.setDate(f.getDate()-1); quitar(m[0]); }
  else if((m = resto.match(/\s(?:pasado manana)\s/))){ f = new Date(hoy); f.setDate(f.getDate()+2); quitar(m[0]); }
  else if((m = resto.match(/\smanana\s/)) && !/\s(?:la|esta|por la|en la)$/.test(resto.slice(0, m.index))){ f = new Date(hoy); f.setDate(f.getDate()+1); quitar(m[0]); }
  else if((m = resto.match(/\s(?:el|este|esta|del|la)?\s*(lunes|martes|miercoles|jueves|viernes|sabado|domingo)(\s+pasado)?\s/))){
    let dif = (hoy.getDay() - DIAS[m[1]] + 7) % 7;
    if(m[2] && dif===0) dif = 7;
    f = new Date(hoy); f.setDate(f.getDate()-dif); quitar(m[0]);
  } else if((m = resto.match(/\sel\s+(\d{1,2})\s(?!\s*(?:dolares|dolar|usd|horas?|minutos?|revisitas?|centavos?|con\s|y\s))/))){
    const d = +m[1];
    if(d>=1 && d<=31){
      f = new Date(hoy.getFullYear(), hoy.getMonth(), d, 12);
      if(d > hoy.getDate() && !previsto) f = new Date(hoy.getFullYear(), hoy.getMonth()-1, d, 12);
      quitar(m[0]);
    }
  }
  if(/\shoy\s/.test(resto)) quitar(/\shoy\s/);
  if(f && !isNaN(f)){ r.fecha = iso(f); r.fechaDicha = true; }

  // ---- Tiempo y revisitas (predicación) ----
  let min = null;
  if((m = resto.match(/\s(\d+(?:[.,]\d+)?)\s*y\s*media\s+horas?\s/))){ min = Math.round(num(m[1])*60)+30; quitar(m[0]); }
  else if((m = resto.match(/\s(\d+(?:[.,]\d+)?)\s*horas?(?:\s*(?:y|con)?\s*(media|cuarto|(\d{1,2})\s*(?:minutos?|min)))?\s/))){
    min = Math.round(num(m[1])*60);
    if(m[2]==='media') min += 30; else if(m[2]==='cuarto') min += 15; else if(m[3]) min += +m[3];
    quitar(m[0]);
  }
  if(min===null && (m = resto.match(/\smedia\s+hora\s/))){ min = 30; quitar(m[0]); }
  if((m = resto.match(/\s(\d{1,3})\s*(?:minutos?|min)\s/))){ min = (min||0) + +m[1]; quitar(m[0]); }
  let rev = null;
  if((m = resto.match(/\s(\d{1,3})\s+revisitas?\s/))){ rev = +m[1]; quitar(m[0]); }
  else if(/\srevisitas?\s/.test(resto)){ rev = 1; }

  // ---- Tipo ----
  const ingreso = RX_INGRESO.test(t), gasto = RX_GASTO.test(t), dinero = RX_DINERO.test(t), pred = RX_PRED.test(t);
  if(pred && !dinero && !ingreso && !gasto) r.tipo = 'pred';
  else if(ingreso && !/\s(gaste|gastamos|pague|pagamos|compre|compramos)\s/.test(t)) r.tipo = 'ingreso';
  else if(gasto || dinero) r.tipo = 'gasto';
  else if(min!==null || rev!==null) r.tipo = 'pred';
  else if(CAT_GASTO.some(([,rx])=>rx.test(t)) && /\d/.test(resto)) r.tipo = 'gasto';
  else if(op.tab==='pred') r.tipo = 'pred';
  else if(/\d/.test(resto)) r.tipo = 'gasto';

  if(r.tipo==='pred'){
    r.min = min||0; r.rev = rev||0;
    if(/\spublica\s/.test(t)) r.nota = 'Predicación pública';
    return r;
  }
  if(!r.tipo) return r;

  // ---- Monto ----
  let cent = null;
  if((m = resto.match(/\s(\d+(?:[.,]\d{1,2})?)\s*(?:dolares|dolar|usd)(?:\s*(?:con|y)\s*(\d{1,2})(?:\s*centavos?)?|\s+y\s+medio)?\s/))){
    cent = Math.round(num(m[1])*100);
    if(m[2]) cent += +m[2]; else if(/y\s+medio\s$/.test(m[0])) cent += 50;
  } else if((m = resto.match(/\s(\d+)\s+(?:con|y)\s+(\d{1,2})(?:\s*centavos?)?\s/))){
    cent = (+m[1])*100 + (+m[2]);
  } else if((m = resto.match(/\s(\d{1,2})\s*centavos?\s/))){
    cent = +m[1];
  } else {
    const todos = resto.match(/\d+(?:[.,]\d{1,2})?/g);
    if(todos) cent = Math.round(num(todos[todos.length-1])*100);
  }
  if(cent!==null && cent>0) r.monto = cent;

  // ---- Categoría ----
  const lista = r.tipo==='gasto' ? CAT_GASTO : CAT_INGRESO;
  for(const [id, rx] of lista){
    const mm = t.match(rx);
    if(mm){ r.cat = id; r.nota = mayus(mm[1]==='sparati' ? 'spa' : mm[1]); break; }
  }
  if(!r.cat) r.cat = r.tipo==='gasto' ? 'otros' : 'otros_in';
  if(r.tipo==='ingreso' && r.cat==='sueldo' && !r.nota) r.nota = 'Sueldo';
  r.estado = previsto ? 'previsto' : 'hecho';
  return r;
}

raiz.CCVoz = {interpretar, normalizar};
})(typeof self!=='undefined' ? self : globalThis);
