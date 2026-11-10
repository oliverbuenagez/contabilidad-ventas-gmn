# Proyecto: Registro de Ventas de Panadería

## 1. Descripción

Aplicación web para registrar **únicamente las ventas** de una panadería y consultar estadísticas de lo vendido. No maneja inventario, producción, proveedores ni pedidos/encargos: cada registro es algo que **ya se vendió**.

Ejemplo de un registro: *"Hoy se vendieron 20 roscas a $1.500 c/u, las compró Marta Gómez, el 4 de noviembre a las 10:30 a. m."*

## 2. Tecnología

- **HTML, CSS y JavaScript puros** (sin frameworks ni librerías de UI).
- **Firebase Firestore** como base de datos (SDK por CDN, módulos ES).
- **GitHub Pages** para publicar.
- Diseño **responsive**, pensado primero para móvil y que funcione bien en computador.
- Moneda: **pesos colombianos sin decimales** (ej. `$2.000`), usando `Intl.NumberFormat('es-CO')`.
- Pago: solo efectivo (no se registra método de pago).
- Usuario: una sola persona por ahora (sin empleados).

## 3. Reglas generales

1. **Todo es editable, anulable y borrable**: productos, clientes y ventas.
2. **Borrar siempre pide confirmación.**
3. **El historial nunca se daña.** Cada venta guarda una "foto" de lo vendido (nombre del producto, precio cobrado, nombre del cliente), de modo que cambiar o archivar un producto o cliente no altera las ventas pasadas.
4. **Los clientes no se pierden.** Aunque un cliente deje de comprar, se conserva en la base de datos con todo su historial.
5. **Exportación:** fuera del alcance por ahora. Todo se consulta dentro de la página. Se evaluará más adelante.

## 4. Módulos

### 4.1 Productos (catálogo de panes)

| Campo | Obligatorio | Descripción |
|---|---|---|
| `nombre` | Sí | Nombre del pan (ej. "Croissant", "Roscas") |
| `panBase` | No | Agrupa presentaciones del mismo pan (ej. "Roscas") para las estadísticas. Si se deja vacío, se usa el nombre |
| `presentacion` | Sí | `unidad` o `paquete` |
| `unidadesPorPaquete` | Sí | 1 si es unidad; N si es paquete (ej. 5) |
| `precio` | Sí | Precio base en pesos (entero) |
| `activo` | Sí | `true` / `false` (archivado) |
| `creadoEn` | Auto | Fecha de creación |

**Reglas:**
- Un mismo pan puede tener varios productos: "Roscas (unidad)" a $1.500 y "Roscas (paquete x5)" a $6.000.
- **Editar:** se puede cambiar cualquier campo; las ventas pasadas no cambian.
- **Archivar:** el producto deja de aparecer al vender, pero queda en el historial.
- **Borrar:** solo se permite del todo si **nunca se ha vendido**. Si tiene ventas, se ofrece archivarlo.
- Las estadísticas cuentan en **unidades reales** (3 paquetes de 5 = 15 unidades) y también muestran cuántos paquetes se vendieron.

### 4.2 Clientes

| Campo | Obligatorio | Descripción |
|---|---|---|
| `nombre` | **Sí** | Único dato que no se puede omitir |
| `telefono` | No | |
| `barrio` | No | |
| `direccion` | No | |
| `activo` | Sí | `true` / `false` (archivado) |
| `creadoEn` | Auto | Fecha de creación |

**Reglas:**
- **Editar:** cualquier dato se puede modificar.
- **Archivar (en lugar de borrar):** el cliente deja de aparecer al registrar ventas nuevas, pero conserva todo su historial y sus ventas siguen contando en las estadísticas. Se puede **reactivar**.
- **Borrar definitivamente:** solo disponible si el cliente no tiene ventas, con confirmación.
- **Cliente anónimo:** las ventas pueden registrarse sin cliente (`clienteId = null`); se muestran como "Cliente anónimo".
- Vista de **historial por cliente**: todas sus compras, total gastado, pan favorito.

### 4.3 Ventas

**Una venta** tiene uno o varios productos (un cliente puede comprar diferentes tipos de pan en la misma venta).

**Encabezado:**

| Campo | Descripción |
|---|---|
| `fecha` | Fecha y hora (por defecto, ahora; editable) |
| `clienteId` | Id del cliente o `null` si es anónimo |
| `clienteNombre` | Nombre del cliente al momento de la venta (copia) |
| `total` | Suma de los subtotales |
| `estado` | `activa` o `anulada` |
| `notas` | Opcional |

**Líneas de venta (dentro de la misma venta):**

| Campo | Descripción |
|---|---|
| `productoId` | Referencia al producto |
| `nombre` | Nombre del producto en ese momento (copia) |
| `panBase` | Pan base en ese momento (copia) |
| `presentacion` | `unidad` o `paquete` (copia) |
| `unidadesPorPaquete` | Copia |
| `cantidad` | Cuántas unidades o paquetes se vendieron |
| `precioUnitario` | **Precio realmente cobrado** (por defecto el precio base; editable por línea) |
| `subtotal` | `cantidad × precioUnitario` |

**Acciones sobre una venta:**
- **Editar:** cambiar fecha, cliente, líneas, cantidades y precios; el total se recalcula.
- **Anular:** la venta queda guardada pero **no cuenta en las estadísticas**. Se puede reactivar.
- **Borrar:** elimina la venta para siempre, con confirmación.

**Flujo de "Nueva venta":**
1. Elegir cliente (o dejar "Cliente anónimo"; opción rápida de crear cliente nuevo).
2. Confirmar fecha y hora.
3. Agregar líneas: elegir producto, cantidad y, si hace falta, modificar el precio.
4. Ver el total en vivo.
5. Guardar.

### 4.4 Historial de ventas

- Tabla/lista de ventas con **filtros** por rango de fechas, mes, cliente, producto y estado (activas/anuladas).
- Cada fila permite ver el detalle, editar, anular o borrar.

### 4.5 Estadísticas

Siempre con selector de **mes y año**; solo cuentan las ventas **activas**.

- Total vendido en el mes y total del día.
- Número de ventas y **ticket promedio**.
- **Pan más vendido por unidades** y **pan que más dinero genera** (pueden ser distintos).
- **Ranking de panes** del mes (unidades, paquetes e ingresos).
- **Ventas por día** (gráfico de barras en HTML/CSS o SVG).
- **Ventas por hora** (horas de mayor venta).
- **Mejores clientes** (por total comprado y por frecuencia).
- **Pan favorito por cliente.**
- Ventas de clientes registrados vs. anónimos.
- **Comparación con el mes anterior** (diferencia en pesos y en porcentaje).
- Mejor y peor día del mes.

Todo se calcula en el navegador con `filter`, `map` y `reduce` sobre las ventas consultadas por rango de fechas.

## 5. Modelo de datos en Firestore

```
productos/{productoId}
  nombre, panBase, presentacion, unidadesPorPaquete,
  precio, activo, creadoEn

clientes/{clienteId}
  nombre, telefono, barrio, direccion, activo, creadoEn

ventas/{ventaId}
  fecha (Timestamp), clienteId, clienteNombre,
  estado ("activa" | "anulada"), total, notas,
  lineas: [
    { productoId, nombre, panBase, presentacion,
      unidadesPorPaquete, cantidad, precioUnitario, subtotal }
  ],
  creadoEn, actualizadoEn
```

- Los precios y totales se guardan como **números enteros** (pesos, sin decimales).
- Las estadísticas consultan `ventas` filtrando por `fecha` (inicio y fin de mes).

## 6. Seguridad (importante)

- La configuración de Firebase queda pública en GitHub Pages; la protección real depende de las **reglas de Firestore**.
- **Fase de pruebas:** se arranca sin contraseña con reglas abiertas. El modo de prueba de Firestore **expira a los 30 días**.
- **Antes de usar ventas reales:** activar **Firebase Authentication** (correo y contraseña, un solo usuario) y reglas que solo permitan acceso a ese usuario. El código quedará preparado para activarlo con un cambio mínimo.

## 7. Estructura de archivos

```
panaderia/
├── index.html
├── css/
│   └── estilos.css
└── js/
    ├── firebase.js        (configuración y conexión)
    ├── utilidades.js      (formato de pesos, fechas, helpers)
    ├── productos.js
    ├── clientes.js
    ├── ventas.js
    ├── estadisticas.js
    └── app.js             (navegación y arranque)
```

## 8. Orden de desarrollo

1. Estructura base, navegación y conexión con Firebase.
2. Productos (crear, editar, archivar, borrar).
3. Clientes (crear, editar, archivar, reactivar, borrar).
4. Nueva venta con varias líneas y precio editable.
5. Historial de ventas con filtros, edición, anulación y borrado.
6. Estadísticas.
7. Pulido de diseño móvil/computador.
8. Publicación en GitHub Pages.
9. Activar login y cerrar reglas de seguridad.

## 9. Fuera del alcance por ahora

- Exportar a Excel/CSV o imprimir (se evaluará después).
- Pedidos o encargos a futuro.
- Inventario y producción.
- Métodos de pago, fiado y descuentos globales.
- Múltiples usuarios y roles.

## 10. Pendientes

- Crear el proyecto en la consola de Firebase (Firestore + app web) y obtener el `firebaseConfig`.
- Definir nombre del negocio y colores (por defecto: diseño cálido tipo panadería).
