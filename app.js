/* Cuentas de la casa — los datos viven solo en este celular.
   Para juntar cuentas, cada uno envía un archivo por WhatsApp y el otro lo recibe. */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['dom','lun','mar','mié','jue','vie','sáb'];
const fmt = new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'});
const money = c => fmt.format((c||0)/100);
const APP = 'cuentas-casa';
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
  config:{base:0, baseMes:null, nombres:['Jonathan','Elba'], mod:0},
  dispositivo:null, yo:null, ultEnvio:0, ultRecibo:null
};
let almacenamientoOk = true;

function cargar(){
  try{
    const s = localStorage.getItem(CLAVE);
    if(s){ const v = JSON.parse(s); if(v && typeof v==='object') E = Object.assign(E, v); }
  }catch(e){ almacenamientoOk = false; }
  if(!E.dispositivo) E.dispositivo = nuevoId();
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
  renderCats(r.delMes);
  renderLista(r.delMes);
}

function renderSinc(){
  const o = nombre(otro());
  $('#sincTit').textContent = 'Juntar cuentas con '+o;
  const lineas = [];
  lineas.push(E.ultEnvio ? 'Enviaste tus cuentas <b>'+esc(textoHace(E.ultEnvio))+'</b>.' : 'Aún no envías tus cuentas.');
  if(E.ultRecibo){
    lineas.push('Recibiste las de '+esc(E.ultRecibo.de||o)+' <b>'+esc(textoHace(E.ultRecibo.cuando))+'</b> (con datos hasta el '+esc(fechaCorta(E.ultRecibo.generado))+').');
  } else lineas.push('Aún no recibes las cuentas de '+esc(o)+'.');
  const d = haceDias(E.ultEnvio);
  const atrasado = lista().length>0 && (d===null || d>=7);
  if(atrasado) lineas.push('<span class="c-warn">Conviene enviarlas: también sirven de respaldo.</span>');
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

function renderCats(delMes){
  const g = delMes.filter(x=>x.tipo==='gasto');
  const blk = $('#bloqueCats');
  if(!g.length){ blk.hidden = true; return; }
  blk.hidden = false;
  const tot = {};
  for(const x of g){ const t = tot[x.cat] || (tot[x.cat]={h:0,p:0}); if(x.estado==='previsto') t.p+=x.monto; else t.h+=x.monto; }
  const filas = Object.entries(tot).map(([id,t])=>({id,h:t.h,p:t.p,s:t.h+t.p})).sort((a,b)=>b.s-a.s);
  const max = filas[0].s || 1;
  $('#cats').innerHTML = filas.map(f=>{
    const ci = catInfo('gasto',f.id);
    return '<div class="cat-row"><span>'+esc(ci.n)+'</span><span class="num"><b>'+money(f.s)+'</b></span>'+
      '<div class="bar"><i style="width:'+(f.h/max*100)+'%;background:'+ci.c+'"></i><i class="prev" style="width:'+(f.p/max*100)+'%;background:'+ci.c+'"></i></div></div>';
  }).join('');
}

function fechaLarga(iso){
  const [y,m,d] = iso.split('-').map(Number);
  if(iso===hoyISO()) return 'Hoy';
  const ay = new Date(); ay.setDate(ay.getDate()-1);
  if(iso===isoDe(ay)) return 'Ayer';
  return DIAS[new Date(y,m-1,d).getDay()]+' '+d+' de '+MESES[m-1];
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
    gr.items.map(x=>{
      const ci = catInfo(x.tipo,x.cat);
      const prev = x.estado==='previsto';
      return '<div class="mov-wrap"><button class="mov'+(prev?' previsto':'')+'" data-id="'+esc(x.id)+'">'+
        '<span class="dot" style="background:'+ci.c+'"></span>'+
        '<span><div class="t">'+esc(x.nota||ci.n)+'</div><div class="s">'+(x.nota?'<span>'+esc(ci.n)+'</span>':'')+'<span>'+esc(nombre(x.quien))+'</span>'+(prev?'<span class="pill prev">Previsto</span>':'')+(x.fijo?'<span class="pill">Cada mes</span>':'')+'</div></span>'+
        '<span class="m num '+(x.tipo==='ingreso'?'c-in':'c-out')+'">'+(x.tipo==='ingreso'?'+ ':'− ')+money(x.monto)+'</span></button>'+
        (prev ? '<button class="marcar" data-marcar="'+esc(x.id)+'">'+(x.tipo==='ingreso'?'Ya se cobró ✓':'Ya se pagó ✓')+'</button>' : '')+
      '</div>';
    }).join('')+'</div>').join('');
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
}
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
  const el = $('#fEliminar'); el.hidden = !x; el.textContent='Eliminar';
  $('#veloMov').hidden=false;
  if(!x) setTimeout(()=>$('#fMonto').focus(),60);
}
function cerrarForm(){ $('#veloMov').hidden=true; editando=null; }
$('#fCancelar').onclick=cerrarForm;
$('#veloMov').addEventListener('click', e=>{ if(e.target.id==='veloMov') cerrarForm(); });
$('#addGasto').onclick=()=>abrirForm('gasto');
$('#addIngreso').onclick=()=>abrirForm('ingreso');

$('#formMov').addEventListener('submit', e=>{
  e.preventDefault();
  const monto = parseMonto($('#fMonto').value);
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
    config:E.config, movs:Object.values(E.movs)};
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
  $('#recTit').textContent = 'Recibir las cuentas de '+o;
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
      mod: Number(c.mod)||0
    };
  }
  E.ultRecibo = {de:String(p.de||'').slice(0,20), generado:String(p.generado||''), cuando:ahora()};
  if(!guardar()) return false;
  pedirPersistencia();
  render();
  const partes = [];
  if(nuevos) partes.push(nuevos+(nuevos===1?' nuevo':' nuevos'));
  if(cambiados) partes.push(cambiados+(cambiados===1?' corregido':' corregidos'));
  if(borrados) partes.push(borrados+(borrados===1?' borrado':' borrados'));
  toast(partes.length ? 'Cuentas juntadas: '+partes.join(', ')+'.' : 'Ya estaban al día. No había nada nuevo.');
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
  E.yo = iSel;
  guardar(); pedirPersistencia();
  $('#veloInicio').hidden = true; render();
});

// ---------- Ajustes ----------
let aYo=0;
function abrirAjustes(){
  $('#aBase').value = E.config.base ? montoTexto(E.config.base) : '';
  $('#aMes').value = E.config.baseMes || ym(new Date());
  $('#aN1').value = nombre(0); $('#aN2').value = nombre(1);
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
  const cambio = base!==(E.config.base||0) || baseMes!==E.config.baseMes || nombres.join('|')!==E.config.nombres.join('|');
  if(cambio) E.config = {base, baseMes, nombres, mod:ahora()};
  E.yo = aYo;
  if(!guardar()) return;
  $('#veloAj').hidden=true; toast('Ajustes guardados'); render();
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

// ---------- Arranque ----------
cargar();
if(!almacenamientoOk) aviso('Este navegador no deja guardar datos. Abre la app en Chrome, fuera del modo incógnito.', true);
render();
if(E.yo===null) abrirInicio();
revisarCompartido();
})();
