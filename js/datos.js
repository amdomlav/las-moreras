/* TPV BETA V1 · Contenido de la simulación (carta, checklists, rúbrica y batería de preguntas)
   © 2026 Ángel Manuel Domínguez Lavado. Todos los derechos reservados. */
'use strict';
var CARTA = {
  "Bebidas": [
    {id:"solo", n:"Café solo", p:1.30, a:[], st:"barra"},
    {id:"cortado", n:"Cortado", p:1.40, a:["Lácteos"], st:"barra"},
    {id:"conleche", n:"Café con leche", p:1.60, a:["Lácteos"], st:"barra"},
    {id:"infusion", n:"Infusión", p:1.50, a:[], st:"barra"},
    {id:"agua", n:"Agua mineral", p:1.50, a:[], st:"barra"},
    {id:"refresco", n:"Refresco", p:2.20, a:[], st:"barra"},
    {id:"cana", n:"Caña de cerveza", p:2.00, a:["Gluten"], st:"barra"},
    {id:"sinalcohol", n:"Cerveza sin alcohol", p:2.20, a:["Gluten"], st:"barra"},
    {id:"zumo", n:"Zumo de naranja natural", p:2.80, a:[], st:"barra"},
    {id:"batido", n:"Batido de plátano y fresa", p:3.20, a:["Lácteos"], st:"barra"}
  ],
  "Comidas": [
    {id:"tostada", n:"Tostada con tomate y aceite", p:2.50, a:["Gluten"], st:"cocina"},
    {id:"tortilla", n:"Pincho de tortilla de patatas", p:3.00, a:["Huevo"], st:"cocina"},
    {id:"bizcocho", n:"Bizcocho casero", p:3.00, a:["Gluten","Huevo","Lácteos"], st:"cocina"},
    {id:"fruta", n:"Fruta de temporada", p:2.50, a:[], st:"cocina"},
    {id:"sandwich", n:"Sándwich mixto", p:4.00, a:["Gluten","Lácteos"], st:"cocina"},
    {id:"ensalada", n:"Ensalada mixta", p:6.50, a:["Huevo","Pescado"], st:"cocina"},
    {id:"quesos", n:"Tabla de quesos con nueces", p:8.00, a:["Lácteos","Frutos de cáscara"], st:"cocina"}
  ]
};
var ITEMS = Object.values(CARTA).flat();
var item = id => ITEMS.find(i=>i.id===id);
var ALERGENOS = ["Gluten","Lácteos","Huevo","Pescado","Frutos de cáscara"];
var MESAS = ["Mesa 1","Mesa 2","Mesa 3","Barra"];
var ROLES = {sala:"Sala", barra:"Barra", cocina:"Cocina / Pase", clientes:"Clientes / Observadores"};
var IVA = 0.10;
var EMPRESA = {nombre:"Las Moreras · Bistró-cafetería", nif:"B00000000 (ficticio)", dir:"Centro de Formación · Monesterio (Badajoz)"};

var FASE_A = [
  {g:"Higiene personal", items:["Llevo el uniforme limpio y completo.","Me he lavado las manos.","Llevo el pelo recogido y no llevo anillos, pulseras ni reloj."]},
  {g:"Puesto de trabajo y menaje", items:["Hemos desinfectado la barra, las mesas y el pase de cocina con un producto autorizado.","Hemos revisado que la vajilla, la cristalería y la cubertería estén limpias, secas y sin desperfectos.","Cogemos las copas por el pie y los cubiertos por el mango.","La cafetera está encendida y purgada."]},
  {g:"Montaje de sala y barra", items:["Las 3 mesas están montadas con mantel o individual, cubiertos, servilleta y copa.","Hay cartas limpias y comanderos preparados.","La barra está repuesta: azúcar, removedores, servilletas, hielo limpio y fruta."]},
  {g:"TPV, caja y datáfono", items:["Hemos comprobado que el TPV funciona y que sala, barra y cocina saben dónde ver sus notas de pedido.","Hemos contado el cambio inicial de la caja y coincide con el que indica el TPV.","Hemos comprobado que el datáfono de prácticas está listo."]}
];
var FASE_D = ["Nos hemos despedido de los clientes y hemos preguntado si todo ha estado a su gusto.","Hemos recogido y desbarasado mesas y barra.","Hemos limpiado y desinfectado equipos, barra, sala y pase con productos autorizados.","Hemos separado los residuos en sus contenedores.","Hemos repuesto los stocks mínimos para el siguiente turno.","Hemos hecho el arqueo y comprobado los tiques frente a la caja."];
var CRITERIOS = [
  {k:"c1", n:"Higiene, seguridad y manipulación", d:["Omite normas básicas de aseo, desinfección o manipulación correcta del menaje y alimentos.","Cumple las normas básicas de higiene y manipulación con indicaciones puntuales.","Mantiene higiene personal, limpieza de puesto y manipulación segura (pie de copa, mango de cubierto) de forma constante.","Aplica rigurosamente los protocolos higiénico-sanitarios y de prevención en todas las fases, anticipando riesgos."]},
  {k:"c2", n:"Trabajo en equipo y gestión de comandas (sala-barra-cocina)", d:["Toma comandas incompletas o descoordina la comunicación entre sala, barra y cocina.","Registra las comandas principales y mantiene una coordinación básica entre puestos.","Gestiona con fluidez el circuito de la nota de pedido desde la toma hasta su preparación en barra/cocina y pase.","Sincroniza tiempos entre sala, barra y cocina con precisión, verifica alérgenos y optimiza el ritmo del equipo."]},
  {k:"c3", n:"Ejecución técnica del servicio y resolución de incidencias", d:["Presenta dificultad con la bandeja, el servicio en barra/mesa o reacciona con inseguridad ante incidencias.","Ejecuta el servicio básico en tiempos aceptables y resuelve incidencias con apoyo.","Trabaja con orden, buena postura, manejo seguro de bandeja y resuelve incidencias (copa, derrame) con cortesía.","Demuestra destreza técnica, elegancia en el trato y resolución ágil, discreta y eficaz de cualquier imprevisto."]},
  {k:"c4", n:"Facturación, cobro (efectivo/tarjeta) y cierre", d:["Comete errores en el tique, el cálculo del cambio en efectivo, el datáfono o deja el cierre incompleto.","Emite tiques y realiza cobros en efectivo o tarjeta con supervisión, completando el cierre básico.","Factura correctamente, ejecuta cobros en efectivo y tarjeta sin errores y realiza limpieza y reposición ordenadas.","Gestiona cobros mixtos/efectivo/tarjeta con total exactitud y rigor, cuadra el cierre y deja el local listo para el siguiente turno."]}
];
var NIVELES = [["En proceso",1,4.9],["Adecuado",5,6.9],["Avanzado",7,8.9],["Excelente",9,10]];

/* Batería inicial de 20 preguntas (higiene, servicio y uso del TPV; sin fiscalidad).
   dif: mf = muy fácil, f = fácil, i = intermedia, d = difícil. El Administrador la carga y la puede editar. */
var DIFICULTADES = {mf:"Muy fácil", f:"Fácil", i:"Intermedia", d:"Difícil"};
var REPARTO = {mf:5, f:3, i:1, d:1};
var TEMAS = ["Higiene","Servicio","TPV"];
var PREGUNTAS_INICIALES = [
  {n:1, dif:"mf", tema:"Higiene", t:"¿Qué hay que hacer antes de empezar a manipular alimentos o menaje?", ok:"Lavarse las manos", otras:["Ponerse perfume","Nada si las manos se ven limpias","Secarse en el delantal"]},
  {n:2, dif:"mf", tema:"Higiene", t:"¿Cómo se coge una copa limpia?", ok:"Por el pie o el tallo", otras:["Por el borde","Por dentro","Con dos dedos en la boca de la copa"]},
  {n:3, dif:"mf", tema:"Higiene", t:"¿Cómo se cogen los cubiertos limpios?", ok:"Por el mango", otras:["Por la parte que toca la comida","A puñados por cualquier lado","Da igual"]},
  {n:4, dif:"mf", tema:"Higiene", t:"Tienes una pequeña herida en la mano. ¿Qué haces antes de trabajar?", ok:"Taparla con un apósito impermeable", otras:["Dejarla al aire","Taparla con una servilleta","Nada"]},
  {n:5, dif:"mf", tema:"Higiene", t:"Al terminar el servicio, ¿qué se hace con los residuos?", ok:"Separarlos en sus contenedores", otras:["Juntarlos en una bolsa","Dejarlos para el día siguiente","Tirarlos al fregadero"]},
  {n:6, dif:"mf", tema:"Servicio", t:"Un cliente dice que es alérgico a los frutos secos. ¿Qué haces?", ok:"Lo marco en la comanda y aviso a cocina y barra", otras:["Nada, ya lo mirará cocina","Lo recuerdo de memoria","Le recomiendo el plato del día"]},
  {n:7, dif:"mf", tema:"Servicio", t:"¿Cómo se despide a los clientes?", ok:"Preguntando si todo ha sido de su agrado y con amabilidad", otras:["Sin decir nada","Recogiendo la mesa mientras se van","Pidiéndoles que se den prisa"]},
  {n:8, dif:"mf", tema:"TPV", t:"¿A dónde va la nota de pedido de un refresco?", ok:"A barra", otras:["A cocina","A caja","A ningún sitio"]},
  {n:9, dif:"mf", tema:"TPV", t:"¿A dónde va la nota de pedido de un plato de comida?", ok:"A cocina", otras:["A barra","A caja","A ningún sitio"]},
  {n:10, dif:"mf", tema:"TPV", t:"Terminas tu turno en el TPV. ¿Qué haces con tu sesión?", ok:"Pulsar Salir para cerrarla", otras:["Dejarla abierta","Apagar solo la pantalla","Dar tu contraseña al compañero"]},
  {n:11, dif:"f", tema:"Higiene", t:"¿Dónde se guardan los productos de limpieza?", ok:"En su sitio, separados de los alimentos", otras:["En la cámara, junto a los alimentos","En la barra, a mano","Donde haya hueco"]},
  {n:12, dif:"f", tema:"Servicio", t:"En el servicio emplatado, ¿por qué lado se retira el plato al cliente?", ok:"Por la derecha", otras:["Por la izquierda","Por delante","Por cualquier lado"]},
  {n:13, dif:"f", tema:"Servicio", t:"Un cliente pregunta si un plato lleva gluten y no lo sabes. ¿Qué haces?", ok:"Consulto la información de alérgenos o pregunto en cocina antes de responder", otras:["Le digo que no lleva","Le digo que pida otra cosa","Le digo que no lo sé y sigo"]},
  {n:14, dif:"f", tema:"TPV", t:"Una cuenta es de 13,50 € y el cliente paga con 20 €. ¿Cuánto cambio devuelves?", ok:"6,50 €", otras:["7,50 €","6,00 €","5,50 €"]},
  {n:15, dif:"f", tema:"TPV", t:"Te equivocas de plato y ya has enviado la comanda. ¿Qué haces?", ok:"Aviso enseguida a cocina y corrijo la comanda en el TPV", otras:["Nada, ya se darán cuenta","Hago otra comanda sin avisar","Se lo digo al cliente al servirlo"]},
  {n:16, dif:"f", tema:"TPV", t:"Una mesa de cuatro quiere pagar cada uno lo suyo. ¿Qué usas en el TPV?", ok:"La opción de dividir la cuenta", otras:["Cuatro tiques escritos a mano","Cobrar todo a uno","Anular la cuenta"]},
  {n:17, dif:"i", tema:"Higiene", t:"¿Cuántos alérgenos de declaración obligatoria hay en la Unión Europea?", ok:"14", otras:["7","10","20"]},
  {n:18, dif:"i", tema:"TPV", t:"Cuatro amigos dividen a partes iguales una cuenta de 46,00 €. ¿Cuánto paga cada uno?", ok:"11,50 €", otras:["12,00 €","11,00 €","10,50 €"]},
  {n:19, dif:"d", tema:"Higiene", t:"Un cliente celíaco pide patatas fritas. Se fríen en el mismo aceite que las croquetas rebozadas. ¿Qué ocurre?", ok:"Hay contaminación cruzada con gluten: no son aptas para él", otras:["No pasa nada porque la patata no tiene gluten","Solo es un problema si el aceite está viejo","Basta con escurrirlas bien"]},
  {n:20, dif:"d", tema:"TPV", t:"Tres amigos dividen a partes iguales una cuenta de 41,40 €. Uno paga su parte con un billete de 20 €. ¿Cuánto cambio le devuelves?", ok:"6,20 €", otras:["6,80 €","13,80 €","5,20 €"]}
];
