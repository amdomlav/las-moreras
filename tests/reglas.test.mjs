// Pruebas de las reglas de seguridad con el emulador de Firestore:
// npx firebase emulators:exec --only firestore --project demo-tpv "node tests/reglas.test.mjs"
// © 2026 Ángel Manuel Domínguez Lavado. Todos los derechos reservados.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp, increment } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-tpv', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 } });
let ok = 0, ko = 0;
const t = async (name, p) => { try { await p; ok++; console.log('  ✓', name); } catch (e) { ko++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); } };
const ctx = (uid, email) => env.authenticatedContext(uid, { email: email || `${uid}@tpv-beta-v1.local` }).firestore();
const anon = env.unauthenticatedContext().firestore();
const adm = ctx('adm', 'admin@tpv-beta-v1.local'), doc1 = ctx('doc1'), al1 = ctx('al1'), al2 = ctx('al2'), al3 = ctx('al3'), al4 = ctx('al4'), intr = ctx('intruso');
const ts = serverTimestamp;
const perfil = (nombre, rol, activo = true, usuario = nombre.toLowerCase()) => ({ nombre, inicial: 'X', usuario, rol, activo, creadoEn: ts() });

console.log('Usuarios');
await t('anónimo no lee nada', assertFails(getDoc(doc(anon, 'config/actual'))));
await t('admin inicial crea su perfil', assertSucceeds(setDoc(doc(adm, 'usuarios/adm'), perfil('Administrador', 'admin', true, 'admin'))));
await t('intruso NO puede crearse perfil de admin', assertFails(setDoc(doc(intr, 'usuarios/intruso'), perfil('Intruso', 'admin', true))));
await t('intruso NO puede crearse perfil de docente', assertFails(setDoc(doc(intr, 'usuarios/intruso'), perfil('Intruso', 'docente', true))));
await t('intruso NO puede crearse perfil activo de alumno', assertFails(setDoc(doc(intr, 'usuarios/intruso'), perfil('Intruso', 'alumno', true))));
await t('admin crea docente', assertSucceeds(setDoc(doc(adm, 'usuarios/doc1'), perfil('Docente', 'docente'))));
for (const a of ['al1', 'al2', 'al3']) await t('admin crea ' + a, assertSucceeds(setDoc(doc(adm, 'usuarios/' + a), perfil(a, 'alumno'))));
await t('al4 pide alta inactiva', assertSucceeds(setDoc(doc(al4, 'usuarios/al4'), perfil('al4', 'alumno', false))));
await t('al4 inactivo no lee config', assertFails(getDoc(doc(al4, 'config/actual'))));
await t('al4 NO se activa a sí mismo', assertFails(updateDoc(doc(al4, 'usuarios/al4'), { activo: true })));
await t('alumno NO se hace docente', assertFails(updateDoc(doc(al1, 'usuarios/al1'), { rol: 'docente' })));
await t('docente NO crea cuentas', assertFails(setDoc(doc(doc1, 'usuarios/x'), perfil('X', 'alumno'))));
await t('docente NO cambia roles', assertFails(updateDoc(doc(doc1, 'usuarios/al1'), { rol: 'docente' })));
await t('docente NO se hace admin', assertFails(updateDoc(doc(doc1, 'usuarios/doc1'), { rol: 'admin' })));
await t('admin NO se desactiva a sí mismo', assertFails(updateDoc(doc(adm, 'usuarios/adm'), { activo: false })));
await t('docente lee la lista de alumnos', assertSucceeds(getDocs(query(collection(doc1, 'usuarios'), where('rol', '==', 'alumno')))));
await t('alumno NO lee el perfil de otro', assertFails(getDoc(doc(al1, 'usuarios/al2'))));
await t('alumno lee su perfil', assertSucceeds(getDoc(doc(al1, 'usuarios/al1'))));

console.log('Preguntas');
const preg = { n: 1, dif: 'mf', tema: 'Higiene', t: '¿Pregunta?', ok: 'Sí', otras: ['a', 'b', 'c'] };
await t('admin carga una pregunta', assertSucceeds(setDoc(doc(adm, 'preguntas/p01'), preg)));
await t('docente NO cambia preguntas', assertFails(setDoc(doc(doc1, 'preguntas/p01'), preg)));
await t('docente lee preguntas', assertSucceeds(getDoc(doc(doc1, 'preguntas/p01'))));
await t('alumno NO lee preguntas (ni respuestas correctas)', assertFails(getDoc(doc(al1, 'preguntas/p01'))));

console.log('Servicio');
const sv = { estado: 'abierto', team: 'Servicio 1', fecha: '2026-11-30', caja: 100, puestos: { sala: ['al1'], barra: ['al2'], cocina: ['al3'] },
  miembros: ['al1', 'al2', 'al3'], nombres: { al1: 'A', al2: 'B', al3: 'C' }, a: [], d: [], arqueo: null, nOrder: 0, nTicket: 0, cashErr: 0, cardDenied: 0,
  cuestionario: null, m: null, creadoEn: ts(), cerradoEn: null };
await t('alumno NO abre servicios', assertFails(setDoc(doc(al1, 'servicios/s1'), sv)));
await t('admin NO abre servicios', assertFails(setDoc(doc(adm, 'servicios/s1'), sv)));
await t('docente abre el servicio', assertSucceeds(setDoc(doc(doc1, 'servicios/s1'), sv)));
await t('docente marca el servicio actual', assertSucceeds(setDoc(doc(doc1, 'config/actual'), { servicio: 's1' })));
await t('alumno NO cambia el servicio actual', assertFails(setDoc(doc(al1, 'config/actual'), { servicio: 'otro' })));
await t('alumno lee el servicio actual', assertSucceeds(getDoc(doc(al1, 'config/actual'))));
await t('alumno del servicio lo lee', assertSucceeds(getDoc(doc(al1, 'servicios/s1'))));
await t('alumno de fuera NO lo lee', assertFails(getDoc(doc(intr, 'servicios/s1'))));
await t('alumno marca la checklist A', assertSucceeds(updateDoc(doc(al2, 'servicios/s1'), { a: ['Me he lavado las manos.'] })));
await t('alumno suma 1 al contador de comandas', assertSucceeds(updateDoc(doc(al1, 'servicios/s1'), { nOrder: 1 })));
await t('alumno NO salta el contador', assertFails(updateDoc(doc(al1, 'servicios/s1'), { nOrder: 10 })));
await t('alumno suma un error de cambio', assertSucceeds(updateDoc(doc(al1, 'servicios/s1'), { cashErr: increment(1) })));
await t('alumno NO cambia los puestos', assertFails(updateDoc(doc(al1, 'servicios/s1'), { puestos: { sala: ['al1'], barra: ['al1'], cocina: ['al1'] } })));
await t('alumno NO cierra el servicio', assertFails(updateDoc(doc(al1, 'servicios/s1'), { estado: 'cerrado' })));
await t('nadie borra un servicio', assertFails(deleteDoc(doc(doc1, 'servicios/s1'))));

console.log('Comandas y tiques');
const com = { id: 'c1', n: 1, mesa: 'Mesa 1', t: 1, rot: 1, lines: [{ pid: 'agua', q: 1, nota: '' }], obs: '<img src=x onerror=alert(1)>', asked: 'no-alergias', allergies: [], risky: false, st: { barra: 'nuevo' }, tm: { barra: {} }, paid: false, por: 'al1' };
await t('sala crea una comanda', assertSucceeds(setDoc(doc(al1, 'servicios/s1/comandas/c1'), com)));
await t('barra NO crea comandas', assertFails(setDoc(doc(al2, 'servicios/s1/comandas/c2'), { ...com, id: 'c2', por: 'al2' })));
await t('sala NO firma comandas como otro', assertFails(setDoc(doc(al1, 'servicios/s1/comandas/c3'), { ...com, id: 'c3', por: 'al2' })));
await t('barra cambia el estado', assertSucceeds(setDoc(doc(al2, 'servicios/s1/comandas/c1'), { ...com, st: { barra: 'recibido' } })));
await t('barra NO cambia las líneas', assertFails(setDoc(doc(al2, 'servicios/s1/comandas/c1'), { ...com, st: { barra: 'recibido' }, lines: [] })));
await t('alumno de fuera NO lee comandas', assertFails(getDocs(collection(intr, 'servicios/s1/comandas'))));
await t('alumno del servicio lee comandas', assertSucceeds(getDocs(collection(al3, 'servicios/s1/comandas'))));
const tk = { id: 'k1', num: 'T0001', fecha: '2026-11-30', hora: '10:00', mesa: 'Mesa 1', tipo: 'simplificada', cliente: { nombre: '', nif: '', dir: '' }, lines: [], total: 1.5, pagos: [{ medio: 'efectivo', importe: 1.5, entregado: 2, cambio: 0.5 }], rot: 1, por: 'al1' };
await t('sala emite un tique', assertSucceeds(setDoc(doc(al1, 'servicios/s1/tiques/k1'), tk)));
await t('nadie cambia un tique', assertFails(updateDoc(doc(al1, 'servicios/s1/tiques/k1'), { total: 0 })));
await t('cocina NO emite tiques', assertFails(setDoc(doc(al3, 'servicios/s1/tiques/k2'), { ...tk, id: 'k2', por: 'al3' })));

console.log('Cuestionario');
const quiz = { servicio: 's1', preguntas: [{ id: 'p01', n: 1, dif: 'mf', tema: 'Higiene', t: '¿Pregunta?', ops: ['b', 'Sí', 'a', 'c'] }], activo: false, creadoEn: ts() };
await t('alumno NO crea cuestionarios', assertFails(setDoc(doc(al1, 'cuestionarios/q1'), quiz)));
await t('docente crea el cuestionario (inactivo)', assertSucceeds(setDoc(doc(doc1, 'cuestionarios/q1'), quiz)));
await t('docente guarda la clave', assertSucceeds(setDoc(doc(doc1, 'cuestionarios/q1/privado/clave'), { ok: { p01: 'Sí' } })));
await t('alumno NO lee un cuestionario inactivo', assertFails(getDoc(doc(al1, 'cuestionarios/q1'))));
await t('alumno NO responde un cuestionario inactivo', assertFails(setDoc(doc(al1, 'respuestas/q1_al1'), { uid: 'al1', qid: 'q1', servicio: 's1', resp: { p01: 'Sí' }, enviadoEn: ts() })));
await t('docente activa el cuestionario', assertSucceeds(updateDoc(doc(doc1, 'cuestionarios/q1'), { activo: true })));
await t('alumno lee el cuestionario activo', assertSucceeds(getDoc(doc(al1, 'cuestionarios/q1'))));
await t('alumno NO lee las respuestas correctas', assertFails(getDoc(doc(al1, 'cuestionarios/q1/privado/clave'))));
await t('alumno de fuera NO lee el cuestionario', assertFails(getDoc(doc(intr, 'cuestionarios/q1'))));
await t('alumno comprueba si ya respondió (aún no)', assertSucceeds(getDoc(doc(al1, 'respuestas/q1_al1'))));
await t('alumno envía sus respuestas', assertSucceeds(setDoc(doc(al1, 'respuestas/q1_al1'), { uid: 'al1', qid: 'q1', servicio: 's1', resp: { p01: 'Sí' }, enviadoEn: ts() })));
await t('alumno NO cambia sus respuestas', assertFails(updateDoc(doc(al1, 'respuestas/q1_al1'), { resp: { p01: 'a' } })));
await t('alumno NO responde por otro', assertFails(setDoc(doc(al1, 'respuestas/q1_al2'), { uid: 'al2', qid: 'q1', servicio: 's1', resp: {}, enviadoEn: ts() })));
await t('alumno NO lee respuestas de otro', assertFails(getDoc(doc(al2, 'respuestas/q1_al1'))));
await t('docente lee todas las respuestas', assertSucceeds(getDocs(query(collection(doc1, 'respuestas'), where('qid', '==', 'q1')))));

console.log('Evaluaciones');
await t('docente guarda una evaluación', assertSucceeds(setDoc(doc(doc1, 'evaluaciones/s1'), { servicio: 's1', alumnos: [] })));
await t('alumno NO lee evaluaciones', assertFails(getDoc(doc(al1, 'evaluaciones/s1'))));
await t('admin NO lee evaluaciones', assertFails(getDoc(doc(adm, 'evaluaciones/s1'))));

console.log('Servicio cerrado');
await t('docente cierra el servicio', assertSucceeds(updateDoc(doc(doc1, 'servicios/s1'), { estado: 'cerrado', m: { a: [0, 13] }, cerradoEn: ts() })));
await t('alumno NO cambia nada tras el cierre', assertFails(updateDoc(doc(al1, 'servicios/s1'), { a: [] })));
await t('alumno NO crea comandas tras el cierre', assertFails(setDoc(doc(al1, 'servicios/s1/comandas/c9'), { ...com, id: 'c9' })));
await t('admin desactiva a al1', assertSucceeds(updateDoc(doc(adm, 'usuarios/al1'), { activo: false })));
await t('alumno desactivado NO lee nada', assertFails(getDoc(doc(al1, 'servicios/s1'))));

console.log(`\n${ok} correctas, ${ko} fallidas`);
await env.cleanup();
process.exit(ko ? 1 : 0);
