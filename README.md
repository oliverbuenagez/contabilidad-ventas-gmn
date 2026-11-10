# 🥖 Sistema de Registro de Ventas y Contabilidad - Panadería

Aplicación web rápida, ligera y responsive (móvil y computador) para registrar ventas, controlar clientes, catálogo de panes y consultar un dashboard de contabilidad con estadísticas detalladas.

## 🚀 Cómo ejecutar localmente

Al utilizar módulos ES de JavaScript (`type="module"`), los navegadores requieren servir los archivos mediante un servidor HTTP local (no abrir directamente con doble clic `file://`):

### Opción 1: Con Python (si lo tienes instalado)
```bash
cd panaderia
python -m http.server 8000
```
Luego abre en tu navegador: [http://localhost:8000](http://localhost:8000)

### Opción 2: Con Node / npx
```bash
cd panaderia
npx serve .
```

### Opción 3: Con VS Code
Instala la extensión **Live Server**, haz clic derecho en `index.html` y selecciona **"Open with Live Server"**.

---

## 🔒 Reglas de Seguridad en Firestore (Fase de Pruebas)

En la consola de Firebase ([console.firebase.google.com](https://console.firebase.google.com)), dirígete a **Firestore Database > Reglas** y asegúrate de que permitan lectura y escritura en modo de prueba:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## 📦 Estructura del Proyecto

```
panaderia/
├── index.html            # Interfaz principal con pestañas y modales
├── css/
│   └── estilos.css       # Diseño cálido artesanal (paleta panadería, responsive)
└── js/
    ├── firebase.js       # Conexión a Firebase Firestore con tus credenciales
    ├── utilidades.js     # Formato de pesos colombianos (sin decimales), fechas, toast, confirmaciones
    ├── productos.js      # Catálogo de panes (unidades/paquetes, archivar, borrar condicional)
    ├── clientes.js       # Directorio de clientes e historial de compras con pan favorito
    ├── ventas.js         # Módulo de caja (múltiples líneas, precios editables, anulación, historial)
    ├── estadisticas.js   # Dashboard contable: ventas diarias, horas pico, rankings y comparativas
    └── app.js            # Enrutamiento de pestañas y botón de carga de datos demo
```

## ✨ Funcionalidades Incluidas

1. **Nueva Venta:**
   - Selección de cliente o venta de mostrador (anónimo).
   - Botón directo para crear cliente nuevo al instante sin salir de la venta.
   - Varias líneas de productos por venta.
   - Modificación libre de la cantidad y del precio unitario cobrado en tiempo real.
   - Cálculo instantáneo del total a cobrar.

2. **Historial de Ventas:**
   - Filtros por rango de fechas, cliente específico y estado (activas/anuladas).
   - Ver detalle completo con la "foto" de los productos al momento de la venta.
   - Editar cualquier venta (se recalculan subtotales y total).
   - Anular ventas (no afectan las estadísticas contables, pero se conserva el registro).
   - Borrado definitivo con confirmación.

3. **Dashboard Contable & Estadísticas:**
   - Selector de mes y año.
   - Total del mes y ventas de hoy en tiempo real.
   - Número de ventas y ticket promedio.
   - Gráfico de barras de ventas diarias del mes con mejor y peor día.
   - Gráfico de horas pico de venta (distribución horaria).
   - Pan más vendido por unidades y pan con mayor generación de ingresos.
   - Proporción entre clientes registrados y clientes anónimos.
   - Comparación porcentual y en pesos frente al mes anterior.
   - Ranking de mejores clientes con frecuencia y pan favorito.

4. **Botón Mágico de Demostración:**
   - En la esquina superior derecha encontrarás el botón **"✨ Cargar datos de ejemplo"**, el cual creará automáticamente un catálogo de panes colombianos, clientes y ventas de muestra para ver el dashboard funcionando inmediatamente.
