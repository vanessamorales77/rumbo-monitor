# Rumbo · Monitor de vehículo en tiempo real

Single Page Application para una sala de control de flota: se conecta a la API pública de [Traccar](https://www.traccar.org/), lista los dispositivos, permite elegir uno y muestra su ubicación en un mapa interactivo junto a una tarjeta de estado (conexión, velocidad, batería y última actualización).

Hecha para la prueba técnica de **Design Engineer (UX/UI)**. El foco está en los estados de la interfaz (carga, error, datos viejos, sin conexión), la suavidad del movimiento, el sistema de diseño y la accesibilidad.

> **Estado del proyecto**
> - Despliegue público: _pendiente_ (ver [Despliegue](#despliegue)).
> - Video de presentación: _pendiente_.

Repositorio: <https://github.com/vanessamorales77/rumbo-monitor>

## Stack

| Área | Elección |
| --- | --- |
| Framework | React 19 + TypeScript, Vite 8 |
| Mapa | Leaflet (marcador SVG propio) |
| Estilos | CSS tradicional con _custom properties_ (tokens), sin framework de UI |
| Tipografía | Inter autoalojada con `@fontsource/inter` (sin peticiones a terceros) |
| Lint | Oxlint |
| Documentación de componentes | Storybook 10 (con el addon de accesibilidad) |

## Ejecutar en local

Requisitos: Node 22.18 o superior (el simulador ejecuta TypeScript de forma nativa).

```bash
npm install
cp .env.example .env
npm run dev
```

La app queda en <http://localhost:5173>.

Hay dos formas de alimentarla:

1. **Simulador integrado (sin cuenta ni red).** Con `VITE_USE_MOCK=true` en `.env`, tres vehículos recorren calles reales de Bogotá. Es la forma más rápida de verla funcionar.
2. **Traccar real.** Con `VITE_USE_MOCK=false` y las credenciales de tu cuenta (ver abajo).

### Usar Traccar real

1. Regístrate en <https://demo4.traccar.org>. Cada servidor de demostración es una instalación independiente: una cuenta de `demo4` no sirve en `demo.traccar.org`.
2. Crea tus dispositivos en esa cuenta (botón **+**). Para usar el simulador de datos, deben tener estos identificadores: `rumbo-npr-01`, `rumbo-master-03` y `rumbo-nmax-06`.
3. Completa `.env`:

```env
VITE_USE_MOCK=false
VITE_TRACCAR_EMAIL=tu-correo@ejemplo.com
VITE_TRACCAR_PASSWORD=tu-contraseña
```

Las credenciales viven en variables `VITE_*`, que Vite incluye en el _bundle_ del navegador. Es aceptable para una cuenta de demostración, pero **nunca uses credenciales reales de producción así**.

### Variables de entorno

| Variable | Para qué sirve | Valor por defecto |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` usa el simulador local y no hace peticiones de red | `true` en `.env.example` |
| `VITE_TRACCAR_EMAIL` / `VITE_TRACCAR_PASSWORD` | Cuenta de Traccar con la que se inicia sesión | vacío |
| `VITE_TRACCAR_BASE` | Origen de la API. Vacío = mismo origen (proxy) | vacío |
| `VITE_TILE_URL` | Plantilla de URL de los _tiles_ del mapa | OpenStreetMap |
| `VITE_TILE_ATTRIBUTION` | Atribución que se muestra en el mapa | OpenStreetMap |
| `TRACCAR_TARGET` | Servidor al que el proxy de desarrollo reenvía `/api` (solo servidor, no llega al navegador) | `https://demo4.traccar.org` |

## Endpoints de Traccar que usa

Todos relativos a `VITE_TRACCAR_BASE` (o al mismo origen):

| Método y ruta | Uso |
| --- | --- |
| `POST /api/session` | Autenticación (`email` y `password` como formulario). La cookie de sesión se envía con `credentials: 'include'` |
| `GET /api/devices` | Lista de dispositivos y su estado de conexión |
| `GET /api/positions` | Última posición de cada dispositivo (carga inicial y _polling_) |
| `WS /api/socket` | Actualizaciones en tiempo real de dispositivos y posiciones |

### CORS en desarrollo

Los servidores de demostración no envían `Access-Control-Allow-Origin`, así que el navegador bloquea las llamadas directas desde otro origen. En desarrollo, Vite hace de proxy de `/api` (incluido el WebSocket) hacia `TRACCAR_TARGET` y reescribe cookies y cabecera `Origin` ([vite.config.ts](vite.config.ts)). Para producción hace falta un equivalente, ver [Despliegue](#despliegue).

## Simulador de datos para Traccar

[scripts/simulate.ts](scripts/simulate.ts) envía posiciones simuladas a tu servidor de Traccar por el endpoint OsmAnd (puerto 5055), para ver la app con datos reales y en movimiento sin rastreadores físicos. Los vehículos siguen rutas por calles reales ([demoRoutes.json](src/api/demoRoutes.json)).

```bash
npm run simulate
npm run simulate -- --host=demo4.traccar.org --interval=10
```

**Presupuesto de posiciones.** Los servidores de demostración parecen guardar como máximo unas 1.500 posiciones por dispositivo y por día (dato no oficial; la hora de reinicio es desconocida). Pasado ese tope siguen aceptando mensajes y marcando el dispositivo como _online_, pero dejan de guardar posiciones. Con `--interval=3` se agota en 75 minutos, con 10 s en unas 4 horas y con 30 s en unas 12. Conviene dejarlo corriendo solo mientras se trabaja o se graba.

## Cómo funciona la conexión

[traccarClient.ts](src/api/traccarClient.ts) implementa una interfaz común (`TelemetrySource`) que también cumple el simulador, así que la UI no sabe de dónde vienen los datos.

- **Tiempo real:** WebSocket primero. Si se cae, pasa a _polling_ cada 5 s y reintenta el socket cada 15 s en segundo plano. El _polling_ pide dispositivos y posiciones, para que el estado de conexión tampoco quede obsoleto.
- **Sesión expirada:** ante un 401 vuelve a iniciar sesión una sola vez y reintenta. Las llamadas simultáneas comparten un único inicio de sesión.
- **Resiliencia:** _timeout_ de 10 s con `AbortController`, errores tipados (`auth`, `network`, `server`, `timeout`) y tramas WebSocket corruptas ignoradas sin tumbar el flujo.
- **Salud del flujo:** si el _polling_ falla dos veces seguidas (~10 s), el estado pasa a `lost`.

## Estados de la interfaz

| Estado | Qué ve el operador |
| --- | --- |
| **Cargando** | Esqueletos de mapa y tarjeta con las mismas clases y alturas que el contenido real, para evitar saltos de layout (CLS). El `<main>` marca `aria-busy` |
| **Error** | Pantalla con mensaje distinto según la causa (red, tiempo agotado, credenciales, servidor), foco en el título y botón **Reintentar** de 44 px. Ofrece además ver el modo demostración |
| **En vivo / Polling** | Indicador sobre el mapa: "En vivo" (WebSocket) o "Actualizando cada 5 s" |
| **Sin datos nuevos** | Un vehículo que figura en línea, pero cuya última posición tiene más de 2 minutos. Un vehículo sin conexión no activa este aviso (su antigüedad ya está en la tarjeta) |
| **Sin conexión** | El _polling_ falla: "Sin conexión · datos desactualizados" |
| **Modo demostración** | Datos simulados, siempre rotulados y con un rombo en lugar de un punto, para que nunca parezcan datos reales. Se puede volver a los reales |
| **Sin señal / sin datos nuevos** | La velocidad **no es cero**: sin conexión (o con una posición de más de 2 minutos) no se sabe, y el vehículo podría seguir moviéndose. En el arco se lee "Sin señal" (offline) o "Sin datos nuevos", con "Última: N km/h" debajo como dato histórico |
| **Detenido** | En línea y a 0 km/h: se mantiene el 0 (es un dato real) y se añade la etiqueta "Detenido", que distingue "parado" de "sin datos". También se anuncia a lectores de pantalla ("vehículo detenido") |
| **Sin posición / sin batería** | Mensajes explícitos ("Sin datos todavía", "No disponible") |

## Decisiones de diseño

- **Jerarquía de la tarjeta:** primero _quién_ (nombre) y _si está vivo_ (conexión), después lo que cambia más rápido (velocidad, con un arco como eco visual del número) y por último batería y frescura del dato.
- **Velocidad:** Traccar entrega nudos; se convierte a km/h con `knots × 1,852` y se redondea.
- **"Conectado" no es "fresco":** un socket abierto puede no entregar nada nuevo, por eso la antigüedad de la última posición se evalúa aparte.
- **Marcador SVG:** el aro y el halo llevan el estado de conexión (verde, gris o ámbar) y la flecha la dirección (`course`). La rotación toma el camino corto (350° → 10° gira 20°, no 340°).
- **Movimiento:** el marcador se desliza 1,8 s con _easing_ entre posiciones (`requestAnimationFrame`) y el mapa lo sigue mientras no se mueva a mano. Si el operador arrastra el mapa o usa las flechas del teclado, el seguimiento se pausa **en ese instante** (no al terminar el gesto, porque mientras el vehículo se desliza el mapa se recentra en cada frame y cancelaría el movimiento) y aparece **Recentrar en el vehículo**. En móvil ese botón es solo un icono de 36 px, con el nombre disponible para lectores de pantalla.
- **Micro-interacciones:** los números se animan hacia su nuevo valor y se resaltan con un realce suave que se desvanece; el texto relativo ("Hace 15 segundos") cambia con un fundido. Se actualizan en pasos de 5 s para que no cambie cada segundo.
- **Tema claro/oscuro:** se guarda la preferencia (o se toma la del sistema) y se aplica antes del primer pintado, sin destello. El mapa oscuro recolorea solo los _tiles_, no los marcadores ni los controles.
- **Responsive:** móvil con mapa arriba y tarjeta debajo (la página hace scroll); tablet y escritorio en dos columnas con mapa y tarjeta siempre de la misma altura.
- **El mapa móvil no se tapa:** en tablet y escritorio el estado del flujo flota sobre el mapa, arriba a la izquierda. En móvil el mapa es pequeño, así que ese estado y su botón ("Ver modo demostración" o "Volver a datos reales") pasan a una franja **encima** del mapa, en el flujo normal de la página. Durante la carga se reserva el hueco de esa franja para que no haya saltos de layout. En el mapa solo quedan el zoom y, si hace falta, el icono de recentrar.

## Sistema de diseño

Tokens en CSS _custom properties_:

- [tokens.css](src/styles/tokens.css): tipografía, escala de espaciado de 4 px, radios, movimiento, tamaños de objetivo táctil y de anillo de foco.
- [themes.css](src/styles/themes.css): paleta de color clara y oscura, sombras y filtros del mapa. Cada color documenta su ratio de contraste sobre la superficie donde se usa.
- [base.css](src/styles/base.css): reset, foco global, enlace de salto y `prefers-reduced-motion`.
- [overrides.css](src/styles/overrides.css): `forced-colors` (alto contraste de Windows) e impresión. Se importa **después** de todos los componentes, porque sus reglas tienen la misma especificidad y solo ganan por orden de carga.

## Accesibilidad (WCAG 2.1 AA)

- **Semántica:** la tarjeta usa `<section>` etiquetada y lista de descripción (`<dl>`, `<dt>`, `<dd>`); la fecha va en `<time dateTime>`; `lang="es"`; enlace "Saltar al contenido".
- **Teclado:** todo es operable con Tab, Espacio y Enter: selector de vehículo (`<select>` nativo), interruptor de tema (`role="switch"`), zoom, recentrar, reintentar. El mapa se puede mover con las flechas. Los objetivos táctiles miden 44 px, o 32–36 px en móvil (por encima del mínimo de 24 px de WCAG 2.2).
- **Foco:** anillo de 3 px de alto contraste con `:focus-visible`; el contorno sigue el radio de cada control. El único `outline: none` (el título del error, que solo recibe foco por programa) tiene el botón de reintento como reemplazo visible.
- **Lectores de pantalla:** región `aria-live` oculta que anuncia solo cambios relevantes (conexión, batería baja, saltos de velocidad de 10 km/h o más), no cada posición. El indicador de flujo es `role="status"`. El mapa es una región con nombre y el marcador una imagen con descripción (nombre, estado, velocidad y rumbo).
- **Color:** el estado nunca depende solo del color (punto más texto). Texto de al menos 14 px.
- **Movimiento:** con `prefers-reduced-motion` se desactivan transiciones, el deslizamiento del marcador y los resaltes.
- **Verificado:** axe-core sin violaciones en claro y oscuro; contraste calculado de todo el texto visible (4,5:1, o 3:1 en texto grande) y de los bordes de controles (3:1). **Aún sin probar con un lector de pantalla real** (NVDA o VoiceOver).

## Storybook

Cada componente tiene _stories_ con todos sus estados (en línea, offline, batería baja, sin posición, error, cargando, etc.) y alternancia de tema.

```bash
npm run storybook          # http://localhost:6006
npm run build-storybook
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con proxy a Traccar |
| `npm run build` | Comprobación de tipos y _build_ de producción |
| `npm run preview` | Sirve el _build_ de producción |
| `npm run lint` | Oxlint |
| `npm run simulate` | Envía posiciones simuladas a Traccar |
| `npm run storybook` | Storybook en desarrollo |

## Estructura

```
src/
├── api/            Cliente de Traccar, simulador local, tipos y rutas de demostración
├── components/     AppShell, StatusCard, Map, FeedStatus, ErrorState, Skeleton,
│                   DeviceSelector, ThemeToggle, ConnectionIndicator (cada uno con su CSS y stories)
├── hooks/          useMonitor (ciclo de datos), useTheme, useNow, useTweenedNumber
├── styles/         tokens, temas y base
└── utils/          conversión de unidades, tiempo relativo, etiquetas de estado
scripts/            Simulador de posiciones para Traccar
```

## Despliegue

_Pendiente._ La app necesita que `/api` (REST y WebSocket) llegue a Traccar desde el mismo origen o desde un origen que añada CORS, porque los servidores de demostración no lo envían. Opciones previstas: _rewrite_ de la plataforma (Vercel o Netlify) o un Worker de Cloudflare como proxy, apuntando `VITE_TRACCAR_BASE` a él. Para el despliegue público hay que poner `VITE_USE_MOCK=false` si se quieren datos reales.

## Notas y límites conocidos

- Los _tiles_ de OpenStreetMap sirven para una demostración, pero su [política de uso](https://operations.osmfoundation.org/policies/tiles/) no cubre tráfico real; para eso, configura `VITE_TILE_URL` con un proveedor con clave.
- Los servidores públicos de Traccar son compartidos: pueden caerse un momento o limitar el almacenamiento (ver el presupuesto del simulador).
- La antigüedad de una posición ("sin datos nuevos") se calcula con el reloj del navegador. Si el equipo del operador va desfasado más de 2 minutos respecto al servidor, los datos pueden verse como viejos aunque lleguen en vivo, o al revés.
- No hay pruebas automáticas todavía.

## Uso de IA

_Pendiente de completar:_ cómo se usó el copiloto, qué prompts fueron clave y qué hubo que corregir porque no cumplía los estándares de UX, visuales o de accesibilidad.
