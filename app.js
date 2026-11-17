/* Cuentas de la casa — los datos viven solo en este celular.
   Para juntar cuentas, cada uno envía un archivo por WhatsApp y el otro lo recibe. */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
const DIAS_L = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const fmt = new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'});
const money = c => fmt.format((c||0)/100);
const APP = 'cuentas-casa';
const VERSION_APP = '6';
const CLAVE = 'cuentas_casa_v1';

const CATS = {
  gasto:[
    {id:'comida',n:'Comida y mercado',c:'#D9822B'},
    {id:'servicios',n:'Luz, agua, internet',c:'#2F80C9'},
    {id:'transporte',n:'Transporte',c:'#7A5BC4'},
    {id:'casa',n:'Casa',c:'#5E8C3A'},
    {id:'salud',n:'Salud',c:'#D0457A'},
    {id:'educacion',n:'Estudios',c:'#1F9E9A'},
    {id:'ropa',n:'Ropa',c:'#B8892E'},
    {id:'deudas',n:'Deudas y cuotas',c:'#C0392B'},
    {id:'trabajo',n:'Trabajo / negocio',c:'#476A8A'},
    {id:'gustos',n:'Salidas y gustos',c:'#E0609A'},
    {id:'otros',n:'Otros',c:'#7D8A96'}
  ],
  ingreso:[
    {id:'sueldo',n:'Sueldo',c:'#1C8048'},
    {id:'negocio',n:'Negocio',c:'#2A9D8F'},
    {id:'ventas',n:'Ventas',c:'#6A9E2F'},
    {id:'prestamo',n:'Préstamo recibido',c:'#B8892E'},
    {id:'otros_in',n:'Otros',c:'#7D8A96'}
  ]
};
const catInfo = (tipo,id) => (CATS[tipo]||[]).find(c=>c.id===id) || {n:'Otros',c:'#7D8A96'};

const pad = n => String(n).padStart(2,'0');
const ym = d => d.getFullYear()+'-'+pad(d.getMonth()+1);
const isoDe = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const hoyISO = () => isoDe(new Date());
const addMes = (m,k) => { const [y,mm]=m.split('-').map(Number); return ym(new Date(y,mm-1+k,1)); };
const nombreMes = m => { const [y,mm]=m.split('-').map(Number); return MESES[mm-1]+' '+y; };
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nuevoId = () => (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const ahora = () => Date.now();

function parseMonto(str){
  let s = String(str||'').replace(/[\s$]/g,'');
  if(!s) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if(lc>-1 && ld>-1){ s = lc>ld ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,''); }
  else if(lc>-1){ s = s.replace(',','.'); }
  if(!/^\d*\.?\d*$/.test(s)) return NaN;
  const v = parseFloat(s);
  return isFinite(v) ? Math.round(v*100) : NaN;
}
// Acepta sumas y restas: "12,50+3+4,25"
function parseSuma(str){
  const s = String(str||'').replace(/\s/g,'');
  if(!s) return NaN;
  const partes = s.match(/[+-]?[^+-]+/g);
  if(!partes || partes.join('')!==s) return NaN;
  let total = 0;
  for(const p of partes){
    const neg = p[0]==='-';
    const v = parseMonto(p.replace(/^[+-]/,''));
    if(isNaN(v)) return NaN;
    total += neg ? -v : v;
  }
  return total;
}
const esSuma = s => /\d\s*[+-]\s*\d/.test(String(s||''));
const montoTexto = c => ((c||0)/100).toFixed(2).replace('.',',');

function fechaCorta(iso){
  if(!iso) return '';
  const d = new Date(iso); if(isNaN(d)) return '';
  return d.getDate()+' de '+MESES[d.getMonth()];
}
function haceDias(ms){
  if(!ms) return null;
  const a = new Date(); a.setHours(0,0,0,0);
  const b = new Date(ms); b.setHours(0,0,0,0);
  return Math.round((a-b)/86400000);
}
function textoHace(ms){
  const d = haceDias(ms);
  if(d===null) return '';
  if(d<=0) return 'hoy'; if(d===1) return 'ayer'; return 'hace '+d+' días';
}

// ---------- Datos (solo en este celular) ----------
let E = {
  movs:{},                     // id -> movimiento (los borrados quedan marcados para que el borrado viaje al otro celular)
  config:{base:0, baseMes:null, nombres:['Jonathan','Elba'], topes:{}, mod:0},
  dispositivo:null, yo:null, ultEnvio:0, ultRecibo:null,
  pred:{},                     // id -> registro de predicación (cada uno es de una persona: quien)
  predMes:{},                  // "2026-11|0" -> {cursos, mod}
  predCfg:{metas:{}},          // "0" -> {min, mod}
  cursos:{},                   // id -> curso bíblico (de una persona: quien)
  tab:'cuentas'
};
let almacenamientoOk = true;

function cargar(){
  try{
    const s = localStorage.getItem(CLAVE);
    if(s){ const v = JSON.parse(s); if(v && typeof v==='object') E = Object.assign(E, v); }
  }catch(e){ almacenamientoOk = false; }
  if(!E.dispositivo) E.dispositivo = nuevoId();
  if(!E.config.topes || typeof E.config.topes!=='object') E.config.topes = {};
  if(!E.pred || typeof E.pred!=='object') E.pred = {};
  if(!E.predMes || typeof E.predMes!=='object') E.predMes = {};
  if(!E.predCfg || typeof E.predCfg!=='object' || !E.predCfg.metas) E.predCfg = {metas:{}};
  if(!E.cursos || typeof E.cursos!=='object') E.cursos = {};
}
function guardar(){
  try{ localStorage.setItem(CLAVE, JSON.stringify(E)); return true; }
  catch(e){ almacenamientoOk = false; aviso('No se pudo guardar en este celular. Revisa que haya espacio libre.', true); return false; }
}
function pedirPersistencia(){
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}
}
const lista = () => Object.values(E.movs).filter(m=>!m.borrado);
const nombre = i => (E.config.nombres && E.config.nombres[i]) || ('Persona '+(i+1));
const otro = () => E.yo===null ? 1 : 1-E.yo;

function limpiarMov(v){
  if(!v || typeof v!=='object' || typeof v.id!=='string' || !v.id || v.id.length>80) return null;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(v.fecha) ? v.fecha : null;
  if(!fecha && !v.borrado) return null;
  const tipo = v.tipo==='ingreso' ? 'ingreso' : 'gasto';
  const monto = Math.round(Number(v.monto));
  return {
    id:v.id, tipo, monto: isFinite(monto)&&monto>=0 ? monto : 0,
    cat: String(v.cat||'otros').slice(0,30), nota: String(v.nota||'').slice(0,80),
    fecha: fecha || '2000-01-01', mes: (fecha||'2000-01-01').slice(0,7),
    estado: v.estado==='previsto' ? 'previsto' : 'hecho',
    quien: v.quien===1 ? 1 : 0, fijo: !!v.fijo, de: v.de ? String(v.de).slice(0,80) : null,
    creado: Number(v.creado)||0, mod: Number(v.mod)||0, borrado: !!v.borrado
  };
}

// ---------- Cálculos ----------
const signo = x => x.tipo==='ingreso' ? x.monto : -x.monto;
function calc(m){
  const todos = lista();
  const delMes = todos.filter(x=>x.mes===m);
  let ingH=0,gasH=0,ingP=0,gasP=0;
  for(const x of delMes){
    const p = x.estado==='previsto';
    if(x.tipo==='ingreso'){ if(p) ingP+=x.monto; else ingH+=x.monto; }
    else { if(p) gasP+=x.monto; else gasH+=x.monto; }
  }
  let ini = 0, antesDeBase = false;
  const bm = E.config.baseMes;
  if(bm && m < bm){ antesDeBase = true; }
  else {
    ini = bm ? (E.config.base||0) : 0;
    for(const x of todos){ if(x.estado!=='previsto' && x.mes>=(bm||'') && x.mes<m) ini += signo(x); }
  }
  const hoy = ini + ingH - gasH;
  return {ini,ingH,gasH,ingP,gasP,hoy,fin:hoy+ingP-gasP,delMes,antesDeBase};
}

// ---------- Render ----------
let mes = ym(new Date());
function render(){
  $('#soy').textContent = E.yo===null ? '—' : 'Este celular: '+nombre(E.yo);
  $('#mesTitulo').textContent = nombreMes(mes);
  $('#irHoy').hidden = (mes===ym(new Date()));
  const r = calc(mes);
  $('#vFin').textContent = money(r.fin);
  $('#vFin').classList.toggle('neg', r.fin<0);
  let nota = 'Incluye lo que falta cobrar y pagar este mes.';
  if(r.fin<0) nota = 'Ojo: con lo previsto, faltarían '+money(-r.fin)+' para cubrir el mes.';
  else if(r.antesDeBase) nota = 'Este mes es anterior al dinero inicial de Ajustes.';
  if(!E.ultRecibo && E.yo!==null) nota += ' Aún sin las cuentas de '+nombre(otro())+'.';
  $('#vFinNota').textContent = nota;
  $('#vHoy').textContent = money(r.hoy);
  $('#vIni').textContent = money(r.ini);
  $('#vIng').textContent = '+ '+money(r.ingH);
  $('#vGas').textContent = '− '+money(r.gasH);
  $('#vIngP').textContent = '+ '+money(r.ingP);
  $('#vGasP').textContent = '− '+money(r.gasP);
  renderSinc();
  renderFijos();
  renderCats();
  renderLista(r.delMes);
  renderPred();
}

function renderSinc(){
  const o = nombre(otro());
  $('#sincTit').textContent = 'Juntar con '+o;
  $('#btnEnviar').textContent = 'Enviar a '+o;
  $('#btnRecibir').textContent = 'Recibir de '+o;
  const lineas = ['Se envían juntas las cuentas y la predicación.'];
  lineas.push(E.ultEnvio ? 'Enviaste tus datos <b>'+esc(textoHace(E.ultEnvio))+'</b>.' : 'Aún no envías tus datos.');
  if(E.ultRecibo){
    lineas.push('Recibiste los de '+esc(E.ultRecibo.de||o)+' <b>'+esc(textoHace(E.ultRecibo.cuando))+'</b> (con datos hasta el '+esc(fechaCorta(E.ultRecibo.generado))+').');
  } else lineas.push('Aún no recibes los datos de '+esc(o)+'.');
  const d = haceDias(E.ultEnvio);
  const hayDatos = lista().length>0 || Object.keys(E.pred).length>0;
  const atrasado = hayDatos && (d===null || d>=7);
  if(atrasado) lineas.push('<span class="c-warn">Conviene enviarlos: también sirven de respaldo.</span>');
  $('#sincEstado').innerHTML = lineas.map(l=>'<span>'+l+'</span>').join('');
  $('#sinc').classList.toggle('atrasado', atrasado);
}

function idFijo(x, m){ return 'fijo-'+(x.de||x.id)+'-'+m; }
function candidatosFijos(){
  const ant = addMes(mes,-1);
  return lista().filter(x=>x.mes===ant && x.fijo && !E.movs[idFijo(x,mes)]);
}
function renderFijos(){
  const box = $('#fijos');
  const c = candidatosFijos();
  if(!c.length){ box.innerHTML=''; return; }
  const mAnt = MESES[Number(addMes(mes,-1).split('-')[1])-1];
  const mAct = MESES[Number(mes.split('-')[1])-1];
  box.innerHTML = '<div class="aviso"><div>En '+mAnt+' hubo <b>'+c.length+'</b> '+(c.length===1?'movimiento que se repite':'movimientos que se repiten')+' cada mes ('+esc(c.slice(0,3).map(x=>x.nota||catInfo(x.tipo,x.cat).n).join(', '))+(c.length>3?'…':'')+').</div><button class="btn" id="traerFijos">Agregarlos a '+mAct+' como previstos</button></div>';
  $('#traerFijos').onclick = traerFijos;
}
function traerFijos(){
  const [y,m] = mes.split('-').map(Number);
  const diasMes = new Date(y,m,0).getDate();
  let n=0;
  for(const x of candidatosFijos()){
    const dia = Math.min(Number(x.fecha.slice(8,10))||1, diasMes);
    const id = idFijo(x,mes);   // mismo id en los dos celulares: al juntar cuentas no se duplica
    E.movs[id] = {id, tipo:x.tipo, monto:x.monto, cat:x.cat, nota:x.nota, fecha:mes+'-'+pad(dia), mes,
      estado:'previsto', quien:x.quien, fijo:true, de:x.de||x.id, creado:ahora(), mod:ahora(), borrado:false};
    n++;
  }
  guardar(); render();
  toast(n+(n===1?' movimiento agregado':' movimientos agregados'));
}

function gastosPorCat(m, hastaDia){
  const t = {};
  for(const x of lista()){
    if(x.tipo!=='gasto' || x.mes!==m) continue;
    if(hastaDia && Number(x.fecha.slice(8,10))>hastaDia) continue;
    const c = t[x.cat] || (t[x.cat]={h:0,p:0});
    if(x.estado==='previsto') c.p+=x.monto; else c.h+=x.monto;
  }
  return t;
}
function renderCats(){
  const blk = $('#bloqueCats');
  const topes = E.config.topes || {};
  const tot = gastosPorCat(mes);
  for(const id of Object.keys(topes)) if(topes[id]>0 && !tot[id]) tot[id]={h:0,p:0};
  const ids = Object.keys(tot);
  if(!ids.length){ blk.hidden = true; return; }
  blk.hidden = false;
  // Comparación: si es el mes en curso, contra octubre "a esta misma fecha"; si no, contra el mes completo
  const ant = addMes(mes,-1);
  const nAnt = MESES[Number(ant.split('-')[1])-1];
  const enCurso = mes===ym(new Date());
  const corte = enCurso ? new Date().getDate() : 0;
  const prev = gastosPorCat(ant, corte);
  const sum = o => Object.values(o).reduce((a,c)=>a+c.h,0);
  const totAct = sum(tot), totAnt = sum(prev);
  let comp = '';
  if(totAnt>0){
    const d = totAct-totAnt;
    const cuando = enCurso ? 'a esta misma fecha de '+nAnt : 'en '+nAnt;
    comp = Math.abs(d)<100 ? 'Van casi igual que '+cuando+' ('+money(totAnt)+').'
      : 'Llevan <b class="'+(d>0?'c-out':'c-in')+'">'+money(Math.abs(d))+' '+(d>0?'más':'menos')+'</b> en gastos que '+cuando+' ('+money(totAnt)+').';
  }
  $('#comp').innerHTML = comp;
  const filas = ids.map(id=>({id,h:tot[id].h,p:tot[id].p,s:tot[id].h+tot[id].p,tope:topes[id]||0}))
    .sort((a,b)=> (b.s-a.s) || (b.tope-a.tope));
  const maxSin = Math.max(1, ...filas.filter(f=>!f.tope).map(f=>f.s));
  $('#cats').innerHTML = filas.map(f=>{
    const ci = catInfo('gasto',f.id);
    const escala = f.tope ? Math.max(f.tope, f.s) : maxSin;
    let color = ci.c, estado = '';
    if(f.tope){
      const r = f.s/f.tope;
      if(r>1){ color='var(--out)'; estado='<span class="c-out">Se pasaron por '+money(f.s-f.tope)+'</span>'; }
      else if(r>=0.8){ color='var(--warn)'; estado='<span class="c-warn">Quedan '+money(f.tope-f.s)+'</span>'; }
      else estado='<span>Quedan '+money(f.tope-f.s)+'</span>';
    }
    const p = prev[f.id] ? prev[f.id].h : 0;
    let vs = '';
    if(p>0 || f.h>0){
      const d = f.h-p;
      vs = p===0 ? '<span>'+nAnt+': $0</span>' : (Math.abs(d)<100 ? '<span>Igual que '+nAnt+'</span>' : '<span class="'+(d>0?'c-out':'c-in')+'">'+(d>0?'+':'−')+money(Math.abs(d))+' vs '+nAnt+'</span>');
    }
    return '<div class="cat-row"><span>'+esc(ci.n)+'</span><span class="num"><b>'+money(f.s)+'</b>'+(f.tope?' de '+money(f.tope):'')+'</span>'+
      '<div class="bar"><i style="width:'+(f.h/escala*100)+'%;background:'+color+'"></i><i class="prev" style="width:'+(f.p/escala*100)+'%;background:'+color+'"></i></div>'+
      ((estado||vs)?'<div class="sub">'+(estado||'<span></span>')+vs+'</div>':'')+'</div>';
  }).join('');
}

function fechaLarga(iso){
  const [y,m,d] = iso.split('-').map(Number);
  if(iso===hoyISO()) return 'Hoy';
  const ay = new Date(); ay.setDate(ay.getDate()-1);
  if(iso===isoDe(ay)) return 'Ayer';
  return DIAS[new Date(y,m-1,d).getDay()]+' '+d+' de '+MESES[m-1];
}
function htmlMov(x, conFecha){
  const ci = catInfo(x.tipo,x.cat);
  const prev = x.estado==='previsto';
  return '<div class="mov-wrap"><button class="mov'+(prev?' previsto':'')+'" data-id="'+esc(x.id)+'">'+
    '<span class="dot" style="background:'+ci.c+'"></span>'+
    '<span><div class="t">'+esc(x.nota||ci.n)+'</div><div class="s">'+(conFecha?'<span class="f">'+esc(fechaLarga(x.fecha))+(x.fecha.slice(0,4)!==String(new Date().getFullYear())?' '+x.fecha.slice(0,4):'')+'</span>':'')+(x.nota?'<span>'+esc(ci.n)+'</span>':'')+'<span>'+esc(nombre(x.quien))+'</span>'+(prev?'<span class="pill prev">Previsto</span>':'')+(x.fijo?'<span class="pill">Cada mes</span>':'')+'</div></span>'+
    '<span class="m num '+(x.tipo==='ingreso'?'c-in':'c-out')+'">'+(x.tipo==='ingreso'?'+ ':'− ')+money(x.monto)+'</span></button>'+
    (prev && !conFecha ? '<button class="marcar" data-marcar="'+esc(x.id)+'">'+(x.tipo==='ingreso'?'Ya se cobró ✓':'Ya se pagó ✓')+'</button>' : '')+
  '</div>';
}
function renderLista(delMes){
  const box = $('#lista');
  if(!delMes.length){
    box.innerHTML = '<div class="vacio">Aún no hay movimientos en '+esc(nombreMes(mes))+'.<br>Toca <b>− Gasto</b> o <b>+ Ingreso</b> para anotar el primero.</div>';
    return;
  }
  const orden = [...delMes].sort((a,b)=> b.fecha.localeCompare(a.fecha) || (b.creado||0)-(a.creado||0));
  const grupos = [];
  for(const x of orden){
    const last = grupos[grupos.length-1];
    if(last && last.f===x.fecha) last.items.push(x); else grupos.push({f:x.fecha,items:[x]});
  }
  box.innerHTML = grupos.map(gr=>'<div class="dia"><div class="dia-tit">'+esc(fechaLarga(gr.f))+'</div>'+
    gr.items.map(x=>htmlMov(x,false)).join('')+'</div>').join('');
}
$('#lista').addEventListener('click', e=>{
  const m = e.target.closest('[data-marcar]');
  if(m){ const x=E.movs[m.getAttribute('data-marcar')]; if(x){ x.estado='hecho'; x.mod=ahora(); guardar(); render(); toast(x.tipo==='ingreso'?'Marcado como cobrado':'Marcado como pagado'); } return; }
  const b = e.target.closest('.mov');
  if(b){ const x = E.movs[b.getAttribute('data-id')]; if(x) abrirForm(x.tipo,x); }
});

// ---------- Avisos ----------
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3200); }
function aviso(html, err){ $('#estado').innerHTML = html ? '<div class="aviso'+(err?' err':'')+'">'+html+'</div>' : ''; }

// ---------- Botones de dos opciones ----------
function pintarSeg(cont, labels, sel, onPick){
  cont.innerHTML = labels.map((l,i)=>'<button type="button" aria-pressed="'+(i===sel)+'" data-i="'+i+'">'+esc(l)+'</button>').join('');
  cont.onclick = e=>{ const b=e.target.closest('button'); if(b) onPick(Number(b.dataset.i)); };
}

// ---------- Formulario de movimiento ----------
let fTipo='gasto', fCat=null, fEstado='hecho', fQuien=0, editando=null, confirmarBorrar=false;
function pintarCats(){
  $('#fCats').innerHTML = CATS[fTipo].map(c=>'<button type="button" class="chip" aria-pressed="'+(c.id===fCat)+'" data-c="'+c.id+'"><i style="background:'+c.c+'"></i>'+esc(c.n)+'</button>').join('');
}
$('#fCats').addEventListener('click', e=>{ const b=e.target.closest('.chip'); if(!b) return; fCat=b.dataset.c; pintarCats(); });
function setTipo(t){
  fTipo=t;
  $('#tGasto').setAttribute('aria-pressed', t==='gasto');
  $('#tIngreso').setAttribute('aria-pressed', t==='ingreso');
  if(!CATS[t].some(c=>c.id===fCat)) fCat=null;
  $('#formTit').textContent = (editando?'Editar ':'Nuevo ')+(t==='gasto'?'gasto':'ingreso');
  $('#fNota').placeholder = t==='gasto' ? 'Ej.: planilla de luz' : 'Ej.: sueldo de noviembre';
  $('#ePrev').textContent = t==='gasto' ? 'No, falta pagar' : 'No, falta cobrar';
  pintarCats();
  pintarFrec();
}
function frecuentes(tipo){
  const desde = isoDe(new Date(Date.now()-120*86400000));
  const g = {};
  for(const x of lista()){
    if(x.tipo!==tipo || x.fecha<desde || x.de) continue;
    const k = x.cat+'|'+x.nota.trim().toLowerCase()+'|'+x.monto;
    const e = g[k] || (g[k]={n:0,ult:0,x});
    e.n++; if((x.creado||0)>=e.ult){ e.ult=x.creado||0; e.x=x; }
  }
  return Object.values(g).filter(e=>e.n>=2).sort((a,b)=> b.n-a.n || b.ult-a.ult).slice(0,4).map(e=>e.x);
}
function pintarFrec(){
  const cont = $('#frecCampo');
  const fs = editando ? [] : frecuentes(fTipo);
  cont.hidden = !fs.length;
  $('#frec').innerHTML = fs.map(x=>'<button type="button" data-f="'+esc(x.id)+'">'+esc(x.nota||catInfo(x.tipo,x.cat).n)+'<small>'+money(x.monto)+'</small></button>').join('');
}
$('#frec').addEventListener('click', e=>{
  const b = e.target.closest('[data-f]'); if(!b) return;
  const x = E.movs[b.dataset.f]; if(!x) return;
  const fecha = mes===ym(new Date()) ? hoyISO() : mes+'-01';
  const id = nuevoId();
  E.movs[id] = {id, tipo:x.tipo, monto:x.monto, cat:x.cat, nota:x.nota, fecha, mes:fecha.slice(0,7), estado:'hecho',
    quien:(E.yo===null?0:E.yo), fijo:false, de:null, creado:ahora(), mod:ahora(), borrado:false};
  if(!guardar()) return;
  cerrarForm(); render();
  toast((x.nota||catInfo(x.tipo,x.cat).n)+' '+money(x.monto)+' anotado. Tócalo en la lista si hay que corregir algo.');
});
function setEstadoF(s){ fEstado=s; $('#eHecho').setAttribute('aria-pressed',s==='hecho'); $('#ePrev').setAttribute('aria-pressed',s==='previsto'); }
$('#tGasto').onclick=()=>setTipo('gasto');
$('#tIngreso').onclick=()=>setTipo('ingreso');
$('#eHecho').onclick=()=>setEstadoF('hecho');
$('#ePrev').onclick=()=>setEstadoF('previsto');

function abrirForm(tipo, x){
  editando = x || null; confirmarBorrar=false;
  fCat = x ? x.cat : null;
  setTipo(tipo);
  setEstadoF(x ? x.estado : 'hecho');
  fQuien = x ? x.quien : (E.yo||0);
  const pintQ = ()=>pintarSeg($('#fQuien'), [nombre(0),nombre(1)], fQuien, i=>{ fQuien=i; pintQ(); });
  pintQ();
  $('#fMonto').value = x ? montoTexto(x.monto) : '';
  $('#fNota').value = x ? x.nota : '';
  $('#fFecha').value = x ? x.fecha : (mes===ym(new Date()) ? hoyISO() : mes+'-01');
  $('#fFijo').checked = x ? x.fijo : false;
  $('#fErr').textContent='';
  mostrarTotal();
  const el = $('#fEliminar'); el.hidden = !x; el.textContent='Eliminar';
  $('#veloMov').hidden=false;
  if(!x) setTimeout(()=>$('#fMonto').focus(),60);
}
function mostrarTotal(){
  const v = $('#fMonto').value;
  if(!esSuma(v)){ $('#fTotal').textContent=''; return; }
  const t = parseSuma(v);
  $('#fTotal').textContent = isNaN(t) ? 'Revisa la suma' : '= '+money(t);
}
$('#fMonto').addEventListener('input', mostrarTotal);
$('#fMas').onclick = ()=>{
  const i = $('#fMonto'); const v = i.value.trim();
  if(v && !/[+-]$/.test(v)) i.value = v+'+';
  i.focus(); mostrarTotal();
};
function cerrarForm(){ $('#veloMov').hidden=true; editando=null; }
$('#fCancelar').onclick=cerrarForm;
$('#veloMov').addEventListener('click', e=>{ if(e.target.id==='veloMov') cerrarForm(); });
$('#addGasto').onclick=()=>abrirForm('gasto');
$('#addIngreso').onclick=()=>abrirForm('ingreso');

$('#formMov').addEventListener('submit', e=>{
  e.preventDefault();
  const monto = parseSuma($('#fMonto').value);
  const fecha = $('#fFecha').value;
  if(!(monto>0)){ $('#fErr').textContent='Escribe un monto mayor que cero, por ejemplo 12,50.'; return; }
  if(!fCat){ $('#fErr').textContent='Elige una categoría.'; return; }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){ $('#fErr').textContent='Elige la fecha.'; return; }
  const id = editando ? editando.id : nuevoId();
  const eraNuevo = !editando;
  E.movs[id] = {
    id, tipo:fTipo, monto, cat:fCat, nota:$('#fNota').value.trim().slice(0,80),
    fecha, mes:fecha.slice(0,7), estado:fEstado, quien:fQuien, fijo:$('#fFijo').checked,
    de: editando ? editando.de : null, creado: editando ? editando.creado : ahora(), mod: ahora(), borrado:false
  };
  if(!guardar()) return;
  pedirPersistencia();
  mes = fecha.slice(0,7);
  cerrarForm(); render();
  toast(eraNuevo ? (fTipo==='gasto'?'Gasto anotado':'Ingreso anotado') : 'Cambios guardados');
});

$('#fEliminar').onclick = ()=>{
  if(!editando) return;
  if(!confirmarBorrar){ confirmarBorrar=true; $('#fEliminar').textContent='Toca otra vez para eliminar'; return; }
  const x = E.movs[editando.id];
  if(x){ x.borrado=true; x.mod=ahora(); guardar(); }
  cerrarForm(); render(); toast('Movimiento eliminado');
};

// ---------- Enviar ----------
function nombreArchivo(){
  const n = nombre(E.yo||0).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'cuentas';
  return 'cuentas-casa-'+n+'-'+hoyISO()+'.txt';
}
function paquete(){
  return {app:APP, v:1, de:nombre(E.yo||0), quien:E.yo, dispositivo:E.dispositivo, generado:new Date().toISOString(),
    config:E.config, movs:Object.values(E.movs),
    pred:Object.values(E.pred), predMes:E.predMes, predCfg:E.predCfg, cursos:Object.values(E.cursos)};
}
function descargar(texto, nombreA){
  const url = URL.createObjectURL(new Blob([texto],{type:'text/plain'}));
  const a = document.createElement('a'); a.href=url; a.download=nombreA;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
async function enviar(){
  const texto = JSON.stringify(paquete());
  const nombreA = nombreArchivo();
  let compartido = false;
  try{
    const f = new File([texto], nombreA, {type:'text/plain'});
    if(navigator.canShare && navigator.canShare({files:[f]})){
      await navigator.share({files:[f], title:'Cuentas de la casa'});
      compartido = true;
    }
  }catch(e){
    if(e && e.name==='AbortError'){ toast('Envío cancelado'); return; }
  }
  if(!compartido){
    descargar(texto, nombreA);
    toast('Archivo guardado en Descargas. Mándalo por WhatsApp a '+nombre(otro())+'.');
  } else toast('Listo. '+nombre(otro())+' debe tocar «Recibir cuentas».');
  E.ultEnvio = ahora(); guardar(); render();
}
$('#btnEnviar').onclick = enviar;

// ---------- Recibir ----------
function abrirRecibir(){
  const o = nombre(otro());
  $('#recTit').textContent = 'Recibir los datos de '+o;
  $('#recPasos').innerHTML =
    '<li>En WhatsApp, descarga el archivo que te mandó '+esc(o)+' (empieza con «cuentas-casa»).</li>'+
    '<li>Toca <b>Elegir archivo</b> y búscalo en <b>Descargas</b> o en la carpeta <b>WhatsApp Documents</b>.</li>'+
    '<li>Más rápido, si la app está instalada: en WhatsApp mantén presionado el archivo, toca <b>Compartir</b> y elige <b>Cuentas de la casa</b>.</li>';
  $('#veloRecibir').hidden = false;
}
$('#btnRecibir').onclick = abrirRecibir;
$('#recCancelar').onclick = ()=>$('#veloRecibir').hidden=true;
$('#veloRecibir').addEventListener('click', e=>{ if(e.target.id==='veloRecibir') $('#veloRecibir').hidden=true; });
$('#recElegir').onclick = ()=>{ const i=$('#archivo'); i.value=''; i.click(); };
$('#archivo').addEventListener('change', async ()=>{
  const f = $('#archivo').files && $('#archivo').files[0];
  if(!f) return;
  $('#veloRecibir').hidden = true;
  if(f.size > 5*1024*1024){ toast('Ese archivo es demasiado grande para ser de esta app.'); return; }
  try{ importarTexto(await f.text()); }catch(e){ toast('No se pudo leer el archivo.'); }
});

function limpiarTopes(t){
  const r = {};
  if(t && typeof t==='object') for(const c of CATS.gasto){ const v=Math.round(Number(t[c.id])); if(v>0 && isFinite(v)) r[c.id]=v; }
  return r;
}
function limpiarPred(v){
  if(!v || typeof v!=='object' || typeof v.id!=='string' || !v.id || v.id.length>80) return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) return null;
  const n = (x,max)=> Math.max(0, Math.min(max, Math.round(Number(x))||0));
  return {id:v.id, quien:v.quien===1?1:0, fecha:v.fecha, mes:v.fecha.slice(0,7), min:n(v.min,1440), rev:n(v.rev,999),
    nota:String(v.nota||'').slice(0,80), creado:Number(v.creado)||0, mod:Number(v.mod)||0, borrado:!!v.borrado};
}
function limpiarCurso(v){
  if(!v || typeof v!=='object' || typeof v.id!=='string' || !v.id || v.id.length>80) return null;
  const s = (x,n)=> String(x||'').slice(0,n);
  return {id:v.id, quien:v.quien===1?1:0, nombre:s(v.nombre,40), libro:s(v.libro,80), avance:s(v.avance,160),
    ultima:/^\d{4}-\d{2}-\d{2}$/.test(v.ultima)?v.ultima:'', activo:v.activo!==false,
    creado:Number(v.creado)||0, mod:Number(v.mod)||0, borrado:!!v.borrado};
}
function importarTexto(texto){
  let p;
  try{ p = JSON.parse(texto); }catch(e){ toast('Ese archivo no es de Cuentas de la casa.'); return false; }
  if(!p || p.app!==APP || !Array.isArray(p.movs)){ toast('Ese archivo no es de Cuentas de la casa.'); return false; }
  if(p.dispositivo && p.dispositivo===E.dispositivo){ toast('Ese archivo salió de este mismo celular.'); return false; }
  let nuevos=0, cambiados=0, borrados=0;
  for(const crudo of p.movs){
    const v = limpiarMov(crudo); if(!v) continue;
    const loc = E.movs[v.id];
    if(!loc){ E.movs[v.id]=v; if(!v.borrado) nuevos++; }
    else if(v.mod > (loc.mod||0)){
      if(v.borrado && !loc.borrado) borrados++; else cambiados++;
      E.movs[v.id]=v;
    }
  }
  const c = p.config;
  if(c && typeof c==='object' && (Number(c.mod)||0) > (E.config.mod||0)){
    E.config = {
      base: Math.round(Number(c.base))||0,
      baseMes: /^\d{4}-\d{2}$/.test(c.baseMes) ? c.baseMes : null,
      nombres: Array.isArray(c.nombres)&&c.nombres.length===2 ? c.nombres.map(n=>String(n).slice(0,20)) : E.config.nombres,
      topes: limpiarTopes(c.topes),
      mod: Number(c.mod)||0
    };
  }
  let pNuevos=0, pCambios=0;
  if(Array.isArray(p.pred)) for(const crudo of p.pred){
    const v = limpiarPred(crudo); if(!v) continue;
    const loc = E.pred[v.id];
    if(!loc){ E.pred[v.id]=v; if(!v.borrado) pNuevos++; }
    else if(v.mod > (loc.mod||0)){ E.pred[v.id]=v; pCambios++; }
  }
  if(p.predMes && typeof p.predMes==='object') for(const k of Object.keys(p.predMes)){
    if(!/^\d{4}-\d{2}\|[01]$/.test(k)) continue;
    const v = p.predMes[k] || {};
    const cur = Math.max(0, Math.min(99, Math.round(Number(v.cursos))||0)), mod = Number(v.mod)||0;
    if(!E.predMes[k] || mod > (E.predMes[k].mod||0)) E.predMes[k] = {cursos:cur, mod};
  }
  if(p.predCfg && p.predCfg.metas && typeof p.predCfg.metas==='object') for(const q of ['0','1']){
    const v = p.predCfg.metas[q]; if(!v) continue;
    const min = Math.max(0, Math.min(400*60, Math.round(Number(v.min))||0)), mod = Number(v.mod)||0;
    const loc = E.predCfg.metas[q];
    if(!loc || mod > (loc.mod||0)) E.predCfg.metas[q] = {min, mod};
  }
  let cNuevos=0, cCambios=0;
  if(Array.isArray(p.cursos)) for(const crudo of p.cursos){
    const v = limpiarCurso(crudo); if(!v) continue;
    const loc = E.cursos[v.id];
    if(!loc){ E.cursos[v.id]=v; if(!v.borrado) cNuevos++; }
    else if(v.mod > (loc.mod||0)){ E.cursos[v.id]=v; cCambios++; }
  }
  E.ultRecibo = {de:String(p.de||'').slice(0,20), generado:String(p.generado||''), cuando:ahora()};
  if(!guardar()) return false;
  pedirPersistencia();
  render();
  const partes = [];
  if(nuevos) partes.push(nuevos+(nuevos===1?' nuevo':' nuevos'));
  if(cambiados) partes.push(cambiados+(cambiados===1?' corregido':' corregidos'));
  if(borrados) partes.push(borrados+(borrados===1?' borrado':' borrados'));
  const msj = [];
  if(partes.length) msj.push('Cuentas: '+partes.join(', '));
  if(pNuevos || pCambios) msj.push('Predicación: '+[pNuevos?pNuevos+(pNuevos===1?' registro nuevo':' registros nuevos'):'', pCambios?pCambios+(pCambios===1?' cambio':' cambios'):''].filter(Boolean).join(', '));
  if(cNuevos || cCambios) msj.push('Cursos bíblicos: '+[cNuevos?cNuevos+(cNuevos===1?' nuevo':' nuevos'):'', cCambios?cCambios+(cCambios===1?' actualizado':' actualizados'):''].filter(Boolean).join(', '));
  toast(msj.length ? 'Datos juntados. '+msj.join('. ')+'.' : 'Ya estaban al día. No había nada nuevo.');
  return true;
}

// Archivo que llega compartido desde WhatsApp (la app instalada recibe el archivo)
async function revisarCompartido(){
  if(!/[?&]recibido=1/.test(location.search)) return;
  try{ history.replaceState(null,'',location.pathname); }catch(e){}
  try{
    const cache = await caches.open('cc-compartido');
    const r = await cache.match('archivo-recibido');
    if(r){ importarTexto(await r.text()); await cache.delete('archivo-recibido'); }
    else toast('No llegó ningún archivo. Usa «Recibir cuentas».');
  }catch(e){ toast('No se pudo abrir el archivo compartido. Usa «Recibir cuentas».'); }
}

// ---------- Primer uso ----------
let iSel=null;
function abrirInicio(){
  $('#iN1').value = E.config.nombres[0]; $('#iN2').value = E.config.nombres[1];
  const pint = ()=>{
    const bs = $('#iQuien').querySelectorAll('button');
    bs[0].textContent = 'Soy '+($('#iN1').value.trim()||'Persona 1');
    bs[1].textContent = 'Soy '+($('#iN2').value.trim()||'Persona 2');
    bs.forEach((b,i)=>b.setAttribute('aria-pressed', i===iSel));
  };
  $('#iN1').oninput = pint; $('#iN2').oninput = pint;
  $('#iQuien').onclick = e=>{ const b=e.target.closest('button'); if(b){ iSel=Number(b.dataset.i); pint(); } };
  pint();
  $('#veloInicio').hidden = false;
}
$('#formInicio').addEventListener('submit', e=>{
  e.preventDefault();
  if(iSel===null){ $('#iErr').textContent='Toca tu nombre para seguir.'; return; }
  const nombres = [$('#iN1').value.trim()||'Persona 1', $('#iN2').value.trim()||'Persona 2'];
  if(nombres.join('|')!==E.config.nombres.join('|')){ E.config.nombres = nombres; E.config.mod = ahora(); }
  E.yo = iSel; verQuien = iSel;
  guardar(); pedirPersistencia();
  $('#veloInicio').hidden = true; render();
});

// ---------- Ajustes ----------
let aYo=0;
function abrirAjustes(){
  $('#aBase').value = E.config.base ? montoTexto(E.config.base) : '';
  $('#aMes').value = E.config.baseMes || ym(new Date());
  $('#aN1').value = nombre(0); $('#aN2').value = nombre(1);
  const tp = E.config.topes || {};
  $('#aTopes').innerHTML = CATS.gasto.map(c=>'<label class="tope" for="tope-'+c.id+'"><span>'+esc(c.n)+'</span><input type="text" inputmode="decimal" id="tope-'+c.id+'" data-tope="'+c.id+'" placeholder="Sin tope" value="'+(tp[c.id]?montoTexto(tp[c.id]):'')+'"></label>').join('');
  aYo = E.yo||0;
  const pint = ()=>pintarSeg($('#aYo'), [$('#aN1').value||'Persona 1',$('#aN2').value||'Persona 2'], aYo, i=>{aYo=i;pint();});
  pint();
  $('#aN1').oninput = pint; $('#aN2').oninput = pint;
  $('#aErr').textContent='';
  $('#veloAj').hidden=false;
}
$('#btnAjustes').onclick=abrirAjustes;
$('#aCancelar').onclick=()=>$('#veloAj').hidden=true;
$('#veloAj').addEventListener('click', e=>{ if(e.target.id==='veloAj') $('#veloAj').hidden=true; });
$('#formAj').addEventListener('submit', e=>{
  e.preventDefault();
  const txt = $('#aBase').value.trim();
  const base = txt ? parseMonto(txt) : 0;
  if(isNaN(base)){ $('#aErr').textContent='El dinero inicial debe ser un número, por ejemplo 250,00.'; return; }
  const baseMes = /^\d{4}-\d{2}$/.test($('#aMes').value) ? $('#aMes').value : ym(new Date());
  const nombres = [$('#aN1').value.trim()||'Persona 1', $('#aN2').value.trim()||'Persona 2'];
  const topes = {};
  for(const inp of document.querySelectorAll('[data-tope]')){
    const t = inp.value.trim(); if(!t) continue;
    const v = parseMonto(t);
    if(isNaN(v) || v<0){ $('#aErr').textContent='Revisa el tope de '+catInfo('gasto',inp.dataset.tope).n+': debe ser un número, por ejemplo 200.'; return; }
    if(v>0) topes[inp.dataset.tope]=v;
  }
  const cambio = base!==(E.config.base||0) || baseMes!==E.config.baseMes || nombres.join('|')!==E.config.nombres.join('|') || JSON.stringify(topes)!==JSON.stringify(E.config.topes||{});
  if(cambio) E.config = {base, baseMes, nombres, topes, mod:ahora()};
  E.yo = aYo; verQuien = aYo;
  if(!guardar()) return;
  $('#veloAj').hidden=true; toast('Ajustes guardados'); render();
});

// ---------- Predicación ----------
let verQuien = null;
const predDe = (q,m) => Object.values(E.pred).filter(x=>!x.borrado && x.quien===q && x.mes===m);
function fmtMin(t){
  t = Math.max(0, Math.round(t||0));
  const h = Math.floor(t/60), mi = t%60;
  if(!h) return mi ? mi+' min' : '0 h';
  return h+' h'+(mi?' '+mi+' min':'');
}
const cursosDe = (q,m) => (E.predMes[m+'|'+q]||{}).cursos||0;
const metaDe = q => (E.predCfg.metas[String(q)]||{}).min||0;
function resumenPred(q,m){
  const rs = predDe(q,m);
  return {rs, min:rs.reduce((a,x)=>a+x.min,0), rev:rs.reduce((a,x)=>a+x.rev,0),
    dias:new Set(rs.filter(x=>x.min>0||x.rev>0).map(x=>x.fecha)).size, cursos:cursosDe(q,m)};
}
function fechaCompleta(iso){
  const [y,m,d] = iso.split('-').map(Number);
  return DIAS_L[new Date(y,m-1,d).getDay()]+' '+d+' de '+MESES[m-1]+' de '+y;
}
function renderPred(){
  if(verQuien===null) verQuien = E.yo===null ? 0 : E.yo;
  const propio = verQuien===(E.yo===null?0:E.yo);
  pintarSeg($('#pQuien'), [nombre(0), nombre(1)], verQuien, i=>{ verQuien=i; renderPred(); });
  $('#pNotaQuien').textContent = propio ? '' : 'Estas son las horas de '+nombre(verQuien)+'. Las anota en su celular y llegan aquí al juntar datos.';
  const r = resumenPred(verQuien, mes);
  const mesN = MESES[Number(mes.split('-')[1])-1];
  $('#pLbl').textContent = 'Horas de predicación en '+mesN;
  $('#pHoras').textContent = fmtMin(r.min);
  $('#pCursos').textContent = r.cursos;
  $('#pRev').textContent = r.rev;
  $('#pDias').textContent = r.dias;
  $('#pCurMenos').disabled = !propio || r.cursos<=0;
  $('#pCurMas').disabled = !propio;
  $('#pMetaBtn').hidden = !propio;
  $('#accPred').hidden = E.tab!=='pred' || !propio;
  // Meta
  const meta = metaDe(verQuien);
  const anillo = $('#pAnillo');
  let txt = '';
  if(meta){
    const pct = Math.min(1, r.min/meta);
    const circ = 2*Math.PI*30;
    $('#pArco').setAttribute('stroke-dasharray', (circ*pct).toFixed(1)+' '+circ.toFixed(1));
    $('#pPct').textContent = Math.floor(r.min/meta*100)+'%';
    anillo.removeAttribute('hidden');
    const falta = meta - r.min;
    const hoy = new Date(), act = ym(hoy);
    if(falta<=0) txt = '<b class="c-in">Meta cumplida:</b> '+fmtMin(meta)+'.';
    else if(mes===act){
      const [y,mm] = mes.split('-').map(Number);
      const quedan = new Date(y,mm,0).getDate() - hoy.getDate() + 1;
      txt = 'Meta: '+fmtMin(meta)+'. Faltan <b>'+fmtMin(falta)+'</b> en '+quedan+(quedan===1?' día':' días')+' (unos '+fmtMin(Math.ceil(falta/quedan/5)*5)+' por día).';
    } else if(mes<act) txt = 'Meta: '+fmtMin(meta)+'. Faltaron '+fmtMin(falta)+'.';
    else txt = 'Meta: '+fmtMin(meta)+'.';
  } else {
    anillo.setAttribute('hidden','');
    txt = propio ? 'Sin meta de horas. Puedes activarla abajo si la necesitas.' : '';
  }
  $('#pMetaTxt').innerHTML = txt;
  renderCursos(propio);
  // Lista
  const box = $('#pLista');
  if(!r.rs.length){
    box.innerHTML = '<div class="vacio">'+(propio ? 'Aún no hay predicación anotada en '+esc(nombreMes(mes))+'.<br>Toca <b>+ Anotar predicación</b> al volver de salir.' : 'Aún no llegan registros de '+esc(nombre(verQuien))+' en '+esc(nombreMes(mes))+'.<br>Pídele que te envíe sus datos.')+'</div>';
    return;
  }
  const orden = [...r.rs].sort((a,b)=> b.fecha.localeCompare(a.fecha) || (b.creado||0)-(a.creado||0));
  const grupos = [];
  for(const x of orden){ const l = grupos[grupos.length-1]; if(l && l.f===x.fecha) l.items.push(x); else grupos.push({f:x.fecha, items:[x]}); }
  box.innerHTML = grupos.map(g=>'<div class="dia"><div class="dia-tit">'+esc(fechaLarga(g.f))+'</div>'+g.items.map(x=>{
    const det = x.rev ? esc(x.rev+(x.rev===1?' revisita':' revisitas')) : '';
    const tag = propio ? 'button' : 'div';
    return '<'+tag+' class="mov"'+(propio?' data-pid="'+esc(x.id)+'"':'')+'><span class="dot pd"></span><span><div class="t">'+esc(x.nota || (x.min ? 'Predicación' : 'Solo revisitas'))+'</div>'+(det?'<div class="s">'+det+'</div>':'')+'</span><span class="m num" style="color:var(--pred)">'+esc(x.min?fmtMin(x.min):'')+'</span></'+tag+'>';
  }).join('')+'</div>').join('');
}
// ---------- Cursos bíblicos ----------
let verTerminados = false, cEdit = null, cBorrar = false;
const cursosDeQ = q => Object.values(E.cursos).filter(c=>!c.borrado && c.quien===q);
function diasDesde(iso){
  if(!iso) return null;
  const [y,m,d] = iso.split('-').map(Number);
  return haceDias(new Date(y,m-1,d).getTime());
}
function renderCursos(propio){
  const q = verQuien;
  const todos = cursosDeQ(q);
  const activos = todos.filter(c=>c.activo).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  const term = todos.filter(c=>!c.activo).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  $('#cTit').textContent = propio ? 'Mis cursos bíblicos' : 'Cursos bíblicos de '+nombre(q);
  $('#cNuevo').hidden = !propio;
  const act = ym(new Date());
  const esteMes = activos.filter(c=>c.ultima && c.ultima.slice(0,7)===act).length;
  $('#cInfo').textContent = activos.length
    ? activos.length+(activos.length===1?' curso activo':' cursos activos')+(mes===act ? ' · '+esteMes+' con estudio este mes' : '')+'.'
    : '';
  const mostrar = verTerminados ? term : activos;
  const card = c=>{
    const dd = diasDesde(c.ultima);
    const cuando = !c.ultima ? 'sin fecha' : dd<=0 ? 'hoy' : dd===1 ? 'ayer' : 'hace '+dd+' días · '+fechaLarga(c.ultima);
    const tag = propio ? 'button' : 'div';
    return '<'+tag+' class="curso'+(c.activo?'':' term')+'"'+(propio?' type="button" data-cid="'+esc(c.id)+'"':'')+'>'+
      '<div class="c-nom">'+esc(c.nombre)+'</div>'+
      (c.libro?'<div class="c-lin"><span class="c-k">Libro</span>'+esc(c.libro)+'</div>':'')+
      (c.avance?'<div class="c-lin"><span class="c-k">Quedamos en</span>'+esc(c.avance)+'</div>':'')+
      '<div class="c-ult'+(c.activo && dd!==null && dd>14?' tarde':'')+'">Última vez: '+esc(cuando)+'</div></'+tag+'>';
  };
  $('#cLista').innerHTML = mostrar.length ? mostrar.map(card).join('')
    : '<div class="vacio" style="padding:12px">'+(verTerminados ? 'No hay cursos terminados.' : (propio ? 'Aún no hay cursos anotados. Toca <b>+ Nuevo</b> para agregar el primero.' : 'Aún no llegan los cursos de '+esc(nombre(q))+'.'))+'</div>';
  const vt = $('#cVerTerm');
  if(verTerminados){ vt.hidden = false; vt.textContent = '← Volver a los cursos activos'; }
  else { vt.hidden = !term.length; vt.textContent = 'Ver terminados ('+term.length+')'; }
}
$('#cVerTerm').onclick = ()=>{ verTerminados = !verTerminados; renderPred(); };
$('#cLista').addEventListener('click', e=>{ const b=e.target.closest('[data-cid]'); if(!b) return; const c=E.cursos[b.dataset.cid]; if(c) abrirCurso(c); });
function pintarCFecha(){ const f=$('#cFecha').value; $('#cFechaTxt').textContent = /^\d{4}-\d{2}-\d{2}$/.test(f) ? fechaCompleta(f) : 'Sin fecha'; }
function abrirCurso(c){
  cEdit = c || null; cBorrar = false;
  $('#cFormTit').textContent = c ? 'Curso con '+c.nombre : 'Nuevo curso bíblico';
  $('#cNombre').value = c ? c.nombre : '';
  $('#cLibro').value = c ? c.libro : '';
  $('#cAvance').value = c ? c.avance : '';
  $('#cFecha').value = c ? c.ultima : hoyISO();
  pintarCFecha();
  const libros = [...new Set(Object.values(E.cursos).filter(x=>!x.borrado && x.libro).map(x=>x.libro))];
  $('#cLibros').innerHTML = libros.map(l=>'<option value="'+esc(l)+'"></option>').join('');
  $('#cErr').textContent = '';
  const t = $('#cTerminar'); t.hidden = !c; t.textContent = c && !c.activo ? 'Volver a cursos activos' : 'Marcar como terminado';
  const el = $('#cEliminar'); el.hidden = !(c && !c.activo); el.textContent = 'Eliminar';
  $('#veloCurso').hidden = false;
  setTimeout(()=>$(c ? '#cAvance' : '#cNombre').focus(), 60);
}
function cerrarCurso(){ $('#veloCurso').hidden = true; cEdit = null; }
$('#cNuevo').onclick = ()=>abrirCurso();
$('#cCancelar').onclick = cerrarCurso;
$('#veloCurso').addEventListener('click', e=>{ if(e.target.id==='veloCurso') cerrarCurso(); });
$('#cHoy').onclick = ()=>{ $('#cFecha').value = hoyISO(); pintarCFecha(); };
$('#cFecha').addEventListener('input', pintarCFecha);
$('#cFecha').addEventListener('change', pintarCFecha);
$('#formCurso').addEventListener('submit', e=>{
  e.preventDefault();
  const nombreC = $('#cNombre').value.trim();
  if(!nombreC){ $('#cErr').textContent = 'Escribe el nombre de la persona.'; return; }
  const f = $('#cFecha').value;
  const id = cEdit ? cEdit.id : nuevoId();
  E.cursos[id] = {id, quien:(E.yo===null?0:E.yo), nombre:nombreC.slice(0,40), libro:$('#cLibro').value.trim().slice(0,80),
    avance:$('#cAvance').value.trim().slice(0,160), ultima:/^\d{4}-\d{2}-\d{2}$/.test(f)?f:'',
    activo: cEdit ? cEdit.activo : true, creado: cEdit ? cEdit.creado : ahora(), mod:ahora(), borrado:false};
  const nuevo = !cEdit;
  if(!guardar()) return;
  pedirPersistencia();
  cerrarCurso(); renderPred(); toast(nuevo ? 'Curso agregado' : 'Avance guardado');
});
$('#cTerminar').onclick = ()=>{
  if(!cEdit) return;
  const c = E.cursos[cEdit.id]; c.activo = !c.activo; c.mod = ahora(); guardar();
  const msg = c.activo ? 'El curso volvió a la lista' : 'Curso marcado como terminado';
  cerrarCurso(); renderPred(); toast(msg);
};
$('#cEliminar').onclick = ()=>{
  if(!cEdit) return;
  if(!cBorrar){ cBorrar = true; $('#cEliminar').textContent = 'Toca otra vez para eliminar'; return; }
  const c = E.cursos[cEdit.id]; c.borrado = true; c.mod = ahora(); guardar();
  cerrarCurso(); renderPred(); toast('Curso eliminado');
};

$('#pLista').addEventListener('click', e=>{
  const b = e.target.closest('[data-pid]'); if(!b) return;
  const x = E.pred[b.dataset.pid]; if(x) abrirPred(x);
});
function cambiarCursos(d){
  const q = E.yo===null?0:E.yo, k = mes+'|'+q;
  const v = Math.max(0, Math.min(99, cursosDe(q,mes)+d));
  E.predMes[k] = {cursos:v, mod:ahora()};
  guardar(); renderPred();
}
$('#pCurMas').onclick = ()=>cambiarCursos(1);
$('#pCurMenos').onclick = ()=>cambiarCursos(-1);

// Formulario de predicación
let pEdit = null, pRev = 0, pBorrar = false;
function leerTiempo(){
  const h = $('#pH').value.trim(), m = $('#pM').value.trim();
  if((h && !/^\d{1,2}$/.test(h)) || (m && !/^\d{1,3}$/.test(m))) return NaN;
  return (Number(h)||0)*60 + (Number(m)||0);
}
function pintarChipsT(){
  const t = leerTiempo();
  document.querySelectorAll('#pChips .chip').forEach(c=>c.setAttribute('aria-pressed', String(Number(c.dataset.min)===t)));
}
function ponerTiempo(t){ $('#pH').value = Math.floor(t/60) || ''; $('#pM').value = t%60 || ''; pintarChipsT(); }
function pintarFechaTxt(){ const f=$('#pFecha').value; $('#pFechaTxt').textContent = /^\d{4}-\d{2}-\d{2}$/.test(f) ? fechaCompleta(f) : ''; }
function pintarRev(){ $('#pRevN').textContent = pRev; $('#pRevMenos').disabled = pRev<=0; }
function abrirPred(x){
  pEdit = x || null; pBorrar = false;
  $('#pFormTit').textContent = x ? 'Editar predicación' : 'Anotar predicación';
  $('#pFecha').value = x ? x.fecha : (mes===ym(new Date()) ? hoyISO() : mes+'-01');
  pintarFechaTxt();
  ponerTiempo(x ? x.min : 0);
  pRev = x ? x.rev : 0; pintarRev();
  $('#pNota').value = x ? x.nota : '';
  $('#pErr').textContent = '';
  const el = $('#pEliminar'); el.hidden = !x; el.textContent = 'Eliminar';
  $('#veloPred').hidden = false;
}
function cerrarPred(){ $('#veloPred').hidden = true; pEdit = null; }
$('#addPred').onclick = ()=>abrirPred();
$('#pCancelar').onclick = cerrarPred;
$('#veloPred').addEventListener('click', e=>{ if(e.target.id==='veloPred') cerrarPred(); });
$('#pFecha').addEventListener('input', pintarFechaTxt);
$('#pFecha').addEventListener('change', pintarFechaTxt);
$('#pChips').addEventListener('click', e=>{ const c=e.target.closest('[data-min]'); if(c) ponerTiempo(Number(c.dataset.min)); });
$('#pH').addEventListener('input', pintarChipsT);
$('#pM').addEventListener('input', pintarChipsT);
$('#pRevMas').onclick = ()=>{ if(pRev<999){ pRev++; pintarRev(); } };
$('#pRevMenos').onclick = ()=>{ if(pRev>0){ pRev--; pintarRev(); } };
$('#formPred').addEventListener('submit', e=>{
  e.preventDefault();
  const fecha = $('#pFecha').value, t = leerTiempo();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)){ $('#pErr').textContent='Elige la fecha.'; return; }
  if(isNaN(t)){ $('#pErr').textContent='Escribe las horas y los minutos solo con números.'; return; }
  if(t>1440){ $('#pErr').textContent='Un día tiene como máximo 24 horas.'; return; }
  if(t<=0 && pRev<=0){ $('#pErr').textContent='Escribe el tiempo o anota al menos una revisita.'; return; }
  const id = pEdit ? pEdit.id : nuevoId();
  E.pred[id] = {id, quien:(E.yo===null?0:E.yo), fecha, mes:fecha.slice(0,7), min:t, rev:pRev, nota:$('#pNota').value.trim().slice(0,80),
    creado: pEdit ? pEdit.creado : ahora(), mod:ahora(), borrado:false};
  const eraNuevo = !pEdit;
  if(!guardar()) return;
  pedirPersistencia();
  mes = fecha.slice(0,7);
  cerrarPred(); render();
  toast(eraNuevo ? (t ? fmtMin(t)+' anotado' : 'Revisitas anotadas') : 'Cambios guardados');
});
$('#pEliminar').onclick = ()=>{
  if(!pEdit) return;
  if(!pBorrar){ pBorrar = true; $('#pEliminar').textContent = 'Toca otra vez para eliminar'; return; }
  const x = E.pred[pEdit.id]; if(x){ x.borrado = true; x.mod = ahora(); guardar(); }
  cerrarPred(); render(); toast('Registro eliminado');
};

// Informe
function textoInforme(q,m){
  const r = resumenPred(q,m);
  const nm = nombreMes(m);
  return ['Informe de predicación', nombre(q)+' · '+nm.charAt(0).toUpperCase()+nm.slice(1), '',
    'Horas: '+fmtMin(r.min), 'Cursos bíblicos: '+r.cursos, 'Revisitas: '+r.rev].join('\n');
}
$('#pInforme').onclick = ()=>{ $('#iTexto').value = textoInforme(verQuien, mes); $('#veloInforme').hidden = false; };
$('#iCerrar').onclick = ()=>$('#veloInforme').hidden = true;
$('#veloInforme').addEventListener('click', e=>{ if(e.target.id==='veloInforme') $('#veloInforme').hidden = true; });
async function copiar(t){
  try{ await navigator.clipboard.writeText(t); return true; }
  catch(e){ try{ const a=$('#iTexto'); a.focus(); a.select(); return document.execCommand('copy'); }catch(e2){ return false; } }
}
$('#iCopiar').onclick = async ()=>{ toast(await copiar($('#iTexto').value) ? 'Informe copiado. Pégalo donde lo envías.' : 'No se pudo copiar. Mantén presionado el texto para copiarlo.'); };
$('#iEnviar').onclick = async ()=>{
  const t = $('#iTexto').value;
  try{
    if(navigator.share){ await navigator.share({text:t}); return; }
  }catch(e){ if(e && e.name==='AbortError') return; }
  location.href = 'https://wa.me/?text='+encodeURIComponent(t);
};

// Meta
$('#pMetaBtn').onclick = ()=>{
  const q = E.yo===null?0:E.yo, m = metaDe(q);
  $('#mTit').textContent = 'Meta de horas de '+nombre(q);
  $('#mHoras').value = m ? String(Math.round(m/60)) : '';
  $('#mErr').textContent = '';
  $('#veloMeta').hidden = false;
};
$('#mRapidas').addEventListener('click', e=>{ const c=e.target.closest('[data-h]'); if(c) $('#mHoras').value = c.dataset.h; });
$('#mCancelar').onclick = ()=>$('#veloMeta').hidden = true;
$('#veloMeta').addEventListener('click', e=>{ if(e.target.id==='veloMeta') $('#veloMeta').hidden = true; });
function guardarMeta(min){
  E.predCfg.metas[String(E.yo===null?0:E.yo)] = {min, mod:ahora()};
  guardar(); $('#veloMeta').hidden = true; renderPred();
  toast(min ? 'Meta guardada: '+fmtMin(min)+' al mes' : 'Meta quitada');
}
$('#mQuitar').onclick = ()=>guardarMeta(0);
$('#formMeta').addEventListener('submit', e=>{
  e.preventDefault();
  const v = $('#mHoras').value.trim();
  if(!v){ guardarMeta(0); return; }
  if(!/^\d{1,3}$/.test(v) || Number(v)<1 || Number(v)>400){ $('#mErr').textContent='Escribe las horas como número entero, por ejemplo 30.'; return; }
  guardarMeta(Number(v)*60);
});

// Pestañas
function aplicarTab(){
  const p = E.tab==='pred';
  $('#tabCuentas').hidden = p; $('#tabPred').hidden = !p;
  $('#accCuentas').hidden = p;
  $('#btnBuscar').hidden = p;
  $('#tabBtnC').setAttribute('aria-selected', String(!p));
  $('#tabBtnP').setAttribute('aria-selected', String(p));
  $('#titulo').textContent = p ? 'Predicación' : 'Cuentas de la casa';
  if(p) $('#slotSincP').appendChild($('#sinc')); else $('#tabCuentas').insertBefore($('#sinc'), $('#fijos'));
  renderPred();
}
function setTab(t){ E.tab = t; guardar(); aplicarTab(); window.scrollTo(0,0); }
$('#tabBtnC').onclick = ()=>setTab('cuentas');
$('#tabBtnP').onclick = ()=>setTab('pred');

// ---------- Buscar ----------
function sinTildes(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function buscar(){
  const q = sinTildes($('#bTexto').value.trim());
  if(!q){ $('#bTot').textContent=''; $('#bLista').innerHTML=''; return; }
  const qMonto = parseMonto(q);
  const res = lista().filter(x=>{
    if(sinTildes(x.nota).includes(q) || sinTildes(catInfo(x.tipo,x.cat).n).includes(q)) return true;
    return !isNaN(qMonto) && qMonto>0 && x.monto===qMonto;
  }).sort((a,b)=> b.fecha.localeCompare(a.fecha)).slice(0,100);
  if(!res.length){ $('#bTot').textContent='No hay movimientos con «'+$('#bTexto').value.trim()+'».'; $('#bLista').innerHTML=''; return; }
  const g = res.filter(x=>x.tipo==='gasto').reduce((a,x)=>a+x.monto,0);
  const i = res.filter(x=>x.tipo==='ingreso').reduce((a,x)=>a+x.monto,0);
  $('#bTot').innerHTML = res.length+(res.length===1?' movimiento':' movimientos')+(g?' · gastos <b class="c-out">'+money(g)+'</b>':'')+(i?' · ingresos <b class="c-in">'+money(i)+'</b>':'');
  $('#bLista').innerHTML = res.map(x=>htmlMov(x,true)).join('');
}
$('#btnBuscar').onclick = ()=>{ $('#veloBuscar').hidden=false; buscar(); setTimeout(()=>$('#bTexto').focus(),60); };
$('#bCerrar').onclick = ()=>$('#veloBuscar').hidden=true;
$('#veloBuscar').addEventListener('click', e=>{ if(e.target.id==='veloBuscar') $('#veloBuscar').hidden=true; });
$('#bTexto').addEventListener('input', buscar);
$('#bLista').addEventListener('click', e=>{
  const b = e.target.closest('.mov'); if(!b) return;
  const x = E.movs[b.getAttribute('data-id')]; if(!x) return;
  $('#veloBuscar').hidden=true; abrirForm(x.tipo,x);
});

// ---------- Navegación ----------
$('#prev').onclick=()=>{ mes=addMes(mes,-1); render(); };
$('#next').onclick=()=>{ mes=addMes(mes,1); render(); };
$('#irHoy').onclick=()=>{ mes=ym(new Date()); render(); };

// ---------- Instalar y funcionar sin internet ----------
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); promptInstalar = e; $('#bannerInstalar').hidden = false; });
$('#btnInstalar').onclick = async ()=>{
  if(!promptInstalar) return;
  promptInstalar.prompt();
  try{ await promptInstalar.userChoice; }catch(e){}
  promptInstalar = null; $('#bannerInstalar').hidden = true;
};
window.addEventListener('appinstalled', ()=>{ $('#bannerInstalar').hidden = true; });
try{
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const instalada = window.navigator.standalone===true || matchMedia('(display-mode: standalone)').matches;
  if(ios && !instalada) $('#bannerIos').hidden = false;
}catch(e){}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// ---------- Actualizar ----------
async function actualizarApp(){
  try{
    const ks = await caches.keys();
    await Promise.all(ks.filter(k=>k!=='cc-compartido').map(k=>caches.delete(k)));
    if(navigator.serviceWorker){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r=>r.update().catch(()=>{}))); }
  }catch(e){}
  location.reload();
}
$('#aActualizar').onclick = ()=>{ $('#aActualizar').textContent = 'Actualizando…'; actualizarApp(); };
$('#aVersion').textContent = 'Versión de la app: '+VERSION_APP;
// Si la pantalla y el programa no son de la misma versión, se actualiza sola una vez
try{
  const vPag = (document.querySelector('meta[name="app-version"]')||{}).content;
  if(vPag && vPag!==VERSION_APP && !sessionStorage.getItem('cc_reparo')){ sessionStorage.setItem('cc_reparo','1'); actualizarApp(); }
}catch(e){}

// ---------- Arranque ----------
cargar();
if(!almacenamientoOk) aviso('Este navegador no deja guardar datos. Abre la app en Chrome, fuera del modo incógnito.', true);
render();
aplicarTab();
if(E.yo===null) abrirInicio();
revisarCompartido();
})();
