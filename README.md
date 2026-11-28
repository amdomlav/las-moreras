# TPV BETA V1 · Simulador «Las Moreras»

Simulador de servicio de bar y restaurante para la formación HOTR0208 (Operaciones básicas de restaurante y bar). Versión de prueba: puede contener errores.

App: https://amdomlav.github.io/tpv-beta-v1/

## Qué cambia respecto a la Beta V0

La V1 mantiene el aspecto y las funciones de la V0 (preservicio, comandas con alérgenos, barra, cocina, caja con IVA 10 %, factura simplificada y completa, efectivo con cambio, datáfono, cuentas divididas y cierre) y corrige sus problemas de seguridad:

- Cada persona entra con su usuario y contraseña (Firebase Authentication). No hay claves escritas en el código.
- Tres roles: **Administrador** (cuentas y batería de preguntas), **docente** (servicio y evaluación) y **alumno** (su puesto y el cuestionario).
- Las reglas de seguridad de Cloud Firestore (`firestore.rules`) deciden en el servidor qué puede leer y escribir cada rol. Están probadas con 72 pruebas automáticas (`tests/reglas.test.mjs`).
- Las librerías van incluidas en `vendor/` (sin CDN) y la página tiene una política de seguridad de contenidos (CSP).
- Cuestionario de 10 preguntas tipo test elegidas por el docente de una batería de 20 (5 muy fáciles, 3 fáciles, 1 intermedia y 1 difícil). Nota final = 0,6 · rúbrica + 0,4 · cuestionario. Solo el docente ve las notas.

## Puesta en marcha (Administrador)

1. En la consola de Firebase: activar Authentication con correo y contraseña, crear Cloud Firestore y crear el usuario `admin@tpv-beta-v1.local`.
2. Publicar el contenido de `firestore.rules` en Firestore > Reglas.
3. Entrar en la app con el usuario `admin`, escribir el nombre y cargar la batería de preguntas.
4. Crear las cuentas del docente y del alumnado (nombre e inicial del primer apellido, sin más datos personales).

## Pruebas para desarrollo

```
npm install --no-save firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-tpv "node tests/reglas.test.mjs"
```

## Licencia

© 2026 Ángel Manuel Domínguez Lavado. Todos los derechos reservados.

Licencia de uso gratuita, sin ánimo de lucro y exclusiva para la Unidad Municipal de Formación y Desarrollo (UMDF) «Antonio Morales Recio» — Las Moreras (Ayuntamiento de Monesterio, Badajoz). Prohibida su distribución o comercialización. Consulta las condiciones completas en [LICENSE.md](LICENSE.md).
