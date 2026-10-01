# Rumbo: monitor de vehículo en tiempo real

Single Page Application para una sala de control de flota: se conecta a la API pública de [Traccar](https://www.traccar.org/), lista los dispositivos, permite elegir uno y muestra su ubicación en un mapa interactivo junto a una tarjeta de estado (conexión, velocidad, batería y última actualización).

Hecha para la prueba técnica de **Design Engineer (UX/UI)**. El foco está en los estados de la interfaz (carga, error, datos viejos, sin conexión), la suavidad del movimiento, el sistema de diseño y la accesibilidad.

> **Estado del proyecto**
> - Aplicación desplegada: <https://rumbo-monitor.vercel.app> (Vercel), que habla con Traccar a través de un Worker de Cloudflare (ver [Despliegue](#despliegue)).
> - Video de presentación: _pendiente_.

Repositorio: <https://github.com/vanessamorales77/rumbo-monitor>

## Qué pide la prueba y dónde está

| Requisito del enunciado | Cómo se cumple |
| --- | --- |
| Autenticarse (`POST /api/session`) | [traccarClient.ts](src/api/traccarClient.ts). La app lo llama al arrancar; en producción el Worker inicia la sesión de verdad con una cuenta que nunca llega al navegador |
| Lista de dispositivos y elegir uno (`GET /api/devices`) | Selector de vehículo nativo en la cabecera (`<select>`) |
| Posición periódica: _polling_ o WebSocket (`GET /api/positions`) | **Las dos**: WebSocket y, si cae, _polling_ cada 5 s ([Cómo funciona la conexión](#cómo-funciona-la-conexión)) |
| Estado de carga sin saltos de diseño (CLS) | Esqueletos con las mismas clases y alturas que el contenido real |
| Estado de error con micro-copy claro y botón de reintento | Pantalla de error con mensaje por causa, **Reintentar** y reintento automático |
| Suavidad del movimiento | El marcador se desliza 1,8 s entre posiciones y deja un rastro que se desvanece |
| Sistema de diseño y tokens | CSS _custom properties_ ([Sistema de diseño](#sistema-de-diseño)) |
| Modo claro/oscuro | Interruptor accesible; sigue al sistema hasta que el usuario elige |
| Micro-interacciones en velocidad, batería y conexión | Los valores se animan hacia el nuevo número y se resaltan; la conexión cambia con un fundido |
| Tarjeta de estado: nombre, conexión con pulso, velocidad en km/h, última actualización | [StatusCard](src/components/StatusCard/StatusCard.tsx) (con batería y placa además) |
| Mapa interactivo, centrado, marcador SVG que rota con `course` o cambia de color | Leaflet; el marcador gira con el rumbo y su aro lleva el estado de conexión |
| Accesibilidad WCAG 2.1 AA (`<dl>`, teclado, foco, `aria-label`, `aria-live`) | Ver [Accesibilidad](#accesibilidad-wcag-21-aa) |
| Repositorio con README (cómo ejecutar, variables y _endpoints_) | Este documento |
| Aplicación desplegada | <https://rumbo-monitor.vercel.app> |
| Video de presentación | _Pendiente_ |

## Stack

| Área | Elección |
| --- | --- |
| Framework | React 19 + TypeScript, Vite 8 |
| Mapa | Leaflet (marcador SVG propio) |
| Estilos | CSS tradicional con _custom properties_ (tokens), sin framework de UI |
| Tipografía | Inter (interfaz) y Barlow Condensed (solo la cifra de velocidad), autoalojadas con `@fontsource` (sin peticiones a terceros) |
| Proxy a Traccar | Cloudflare Worker (un archivo, sin dependencias) con pruebas de `node:test` |
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

**Solo en desarrollo:** las variables `VITE_*` las incluye Vite en el _bundle_ del navegador, así que sirven para una cuenta de demostración en tu equipo, pero no son un lugar seguro para una contraseña. En producción no se usan: la cuenta vive como secreto en el Worker de Cloudflare ([Despliegue](#despliegue)).

### Variables de entorno

| Variable | Para qué sirve | Valor por defecto |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` usa el simulador local y no hace peticiones de red. En producción debe ser `false` | `true` en `.env.example` |
| `VITE_TRACCAR_EMAIL` / `VITE_TRACCAR_PASSWORD` | Cuenta de Traccar con la que se inicia sesión. **Solo desarrollo**; en producción no se definen | vacío |
| `VITE_TRACCAR_BASE` | Origen de la API. Vacío = mismo origen (el proxy de Vite en desarrollo). En producción, la URL del Worker | vacío |
| `VITE_TILE_URL` | Plantilla de URL de los _tiles_ del mapa | OpenStreetMap |
| `VITE_TILE_ATTRIBUTION` | Atribución que se muestra en el mapa | OpenStreetMap |
| `TRACCAR_TARGET` | Servidor al que el proxy de desarrollo reenvía `/api` (solo servidor, no llega al navegador) | `https://demo4.traccar.org` |

## Endpoints de Traccar que usa

Todos relativos a `VITE_TRACCAR_BASE` (o al mismo origen):

| Método y ruta | Uso |
| --- | --- |
| `POST /api/session` | Autenticación (`email` y `password` como formulario). En desarrollo la hace el proxy de Vite con tu cuenta; en producción la app envía la llamada y el Worker inicia la sesión con la cuenta que guarda como secreto, así que las credenciales de la app van vacías |
| `GET /api/devices` | Lista de dispositivos y su estado de conexión |
| `GET /api/positions` | Última posición de cada dispositivo (carga inicial y _polling_) |
| `WS /api/socket` | Actualizaciones en tiempo real de dispositivos y posiciones |

### CORS en desarrollo

Los servidores de demostración no envían `Access-Control-Allow-Origin`, así que el navegador bloquea las llamadas directas desde otro origen. En desarrollo, Vite hace de proxy de `/api` (incluido el WebSocket) hacia `TRACCAR_TARGET` y reescribe cookies y cabecera `Origin` ([vite.config.ts](vite.config.ts)). En producción ese papel lo hace un Worker de Cloudflare ([worker/](worker/)), que además guarda la cuenta de Traccar para que no viaje en el navegador. Ver [Despliegue](#despliegue).

## Simulador de datos para Traccar

**Por qué existe.** La app solo _lee_: en un sistema real, los datos los producen rastreadores GPS en los vehículos, que envían sus posiciones a Traccar. El enunciado daba por hecho que las credenciales de demostración (`admin/admin` o `demo/demo`) traían vehículos de ejemplo ya en movimiento. A finales de septiembre de 2026 se probaron en los servidores `demo`, `demo2`, `demo3` y `demo4`: **las cuatro respuestas fueron 401**. Hay que registrar una cuenta propia, y una cuenta nueva **no trae ningún dispositivo**. Sin vehículos que envíen datos no habría nada que ver, así que el simulador hace el papel de esos rastreadores. No forma parte del producto: la interfaz solo habla con Traccar y no sabe quién produce los datos, y con rastreadores reales funcionaría igual.

[scripts/simulate.ts](scripts/simulate.ts) envía posiciones simuladas a tu servidor de Traccar por el endpoint OsmAnd (puerto 5055), para ver la app con datos reales y en movimiento sin rastreadores físicos. Los vehículos siguen rutas por calles reales ([demoRoutes.json](src/api/demoRoutes.json)): tres circuitos de Bogotá calculados una sola vez con [OSRM](https://project-osrm.org/) sobre datos de [OpenStreetMap](https://www.openstreetmap.org/copyright) (© colaboradores de OpenStreetMap) y guardados como datos fijos, así que el simulador no depende de ningún servicio para funcionar.

```bash
npm run simulate
npm run simulate -- --host=demo4.traccar.org --interval=10
```

**Presupuesto de posiciones.** Los servidores de demostración guardan como máximo unas 1.500 posiciones por dispositivo y por día (dato no oficial; el foro de Traccar habla de ese mismo tope). Se comprobó con los datos de la cuenta: el 30 de septiembre cada vehículo se detuvo en exactamente 1.500 posiciones y, al día siguiente, el servidor volvió a guardar, así que el cupo se renueva a diario; la hora exacta del reinicio no se conoce. Pasado el tope, el servidor sigue aceptando mensajes y marcando el dispositivo como _online_, pero deja de guardar posiciones (lo que se ve en la app es justo el estado «Sin datos nuevos»). Con `--interval=3` se agota en 75 minutos, con 10 s en unas 4 horas y con 30 s en unas 12. Conviene dejarlo corriendo solo mientras se trabaja o se graba.

## Cómo funciona la conexión

[traccarClient.ts](src/api/traccarClient.ts) implementa una interfaz común (`TelemetrySource`) que también cumple el simulador, así que la UI no sabe de dónde vienen los datos.

- **Tiempo real:** WebSocket primero. Si se cae, pasa a _polling_ cada 5 s y reintenta el socket cada 15 s en segundo plano. El _polling_ pide dispositivos y posiciones, para que el estado de conexión tampoco quede obsoleto.
- **Sesión expirada:** contra Traccar directo (desarrollo), ante un 401 vuelve a iniciar sesión una sola vez y reintenta; las llamadas simultáneas comparten un único inicio de sesión. En producción lo resuelve el Worker, que autentica cada llamada ([Despliegue](#despliegue)).
- **Resiliencia:** _timeout_ de 10 s con `AbortController`, errores tipados (`auth`, `network`, `server`, `timeout`) y tramas WebSocket corruptas ignoradas sin tumbar el flujo.
- **Salud del flujo:** si el _polling_ falla dos veces seguidas (~10 s), el estado pasa a `lost`.

## Estados de la interfaz

| Estado | Qué ve el operador |
| --- | --- |
| **Cargando** | Esqueletos de mapa y tarjeta con las mismas clases y alturas que el contenido real, para evitar saltos de layout (CLS); el selector de la cabecera conserva su ancho ("Cargando vehículos…"). La carga cubre también los _tiles_: el esqueleto del mapa sigue hasta que cargan las teselas alrededor del vehículo y se desvanece, así el mapa no aparece a medio pintar. La tarjeta entra con un fundido corto. Si pasan más de 5 s, el texto admite la demora ("Está tardando más de lo normal…") en vez de callar. El `<main>` marca `aria-busy` |
| **Error** | Pantalla con mensaje distinto según la causa (red, tiempo agotado, credenciales, servidor), foco en el título y botón **Reintentar** de 44 px. Ofrece además ver el modo demostración. **Se reintenta sola** a los 15 s (30 y 60 s si sigue fallando) con una cuenta atrás visible y un botón "Detener" (WCAG 2.2.1: un límite de tiempo que el usuario puede desactivar). Con credenciales rechazadas no hay reintento automático: no se arreglan solas. Los reintentos automáticos no roban el foco; el primer error sí |
| **Datos en vivo / Polling** | Indicador sobre el mapa: "Datos en vivo" (WebSocket) o "Actualizando cada 5 s". Habla de los datos, no del vehículo: "En línea" es el estado de un vehículo, y los dos nunca se confunden |
| **Sin datos nuevos / Ningún vehículo en línea** | El aviso es sobre **la flota**, no sobre el vehículo seleccionado: aparece si ningún vehículo figura en línea («Ningún vehículo en línea»), si los que lo están no han enviado ninguna posición, o si el más reciente lleva más de 2 minutos sin reportar. Un solo vehículo quieto o sin conexión no lo activa (su antigüedad ya está en la tarjeta). En ambos casos se ofrece el modo demostración |
| **Sin conexión** | El _polling_ falla: "Sin conexión" con "datos desactualizados" en un texto secundario más tenue |
| **Modo demostración** | Datos simulados, siempre rotulados y con un rombo en lugar de un punto, para que nunca parezcan datos reales. Se puede volver a los reales |
| **Sin señal / sin datos nuevos** | La velocidad **no es cero**: sin conexión (o con una posición de más de 2 minutos) no se sabe, y el vehículo podría seguir moviéndose. En el arco se lee "Sin señal" (offline) o "Sin datos nuevos", con "Última: N km/h" debajo como dato histórico |
| **Detenido** | En línea y a 0 km/h: se mantiene el 0 (es un dato real) y se añade la etiqueta "Detenido", que distingue "parado" de "sin datos". También se anuncia a lectores de pantalla ("vehículo detenido") |
| **Sin posición / sin batería** | Mensajes explícitos ("Sin datos todavía", "No disponible"). Si el vehículo elegido nunca ha reportado una posición, el mapa **no muestra ningún marcador** (ni el del vehículo anterior) |
| **Cuenta sin vehículos** | El inicio de sesión funciona pero la cuenta no tiene dispositivos: la columna de la tarjeta explica «Todavía no hay vehículos» en vez de quedar en blanco |

## Decisiones de diseño

- **Identidad:** la marca es el propio marcador (la misma flecha dentro de un aro), que es lo que el operador vigila en el mapa; también es el favicon. La placa se muestra como una placa (fondo amarillo, caracteres oscuros) junto al modelo, y la cabecera resume la flota ("2 de 3 en línea"; en móvil, ese resumen va en la franja sobre el mapa). La cifra de velocidad y el nombre de la marca usan Barlow Condensed, una tipografía de rotulación vial, y el resto Inter (incluidos los controles del mapa: el zoom dibuja iconos SVG, en lugar de los glifos monoespaciados que trae Leaflet).
- **Jerarquía de la tarjeta:** primero _quién_ (nombre) y _si está vivo_ (conexión), después lo que cambia más rápido (velocidad, con un arco como eco visual del número) y por último batería y frescura del dato.
- **Velocidad:** Traccar entrega nudos; se convierte a km/h con `knots × 1,852` y se redondea.
- **"Conectado" no es "fresco":** un socket abierto puede no entregar nada nuevo, por eso la antigüedad de la última posición se evalúa aparte.
- **Rastro del vehículo:** detrás del marcador queda una estela que se desvanece con sus últimas ~40 posiciones, para ver de dónde viene y hacia dónde va sin tener que recordarlo. Un vehículo parado no deja rastro y se reinicia al cambiar de vehículo. Si hay un silencio de más de 60 s entre dos posiciones, el marcador salta y el rastro empieza de nuevo, en lugar de dibujar una línea recta (un "vuelo") sobre un trayecto que no se conoce; lo mismo con la pestaña oculta o con el movimiento reducido: sin animar, pero sin perder puntos. El rastro une posiciones GPS con líneas rectas, así que con posiciones muy espaciadas corta las esquinas en los giros (no se ajusta a las calles). Se acumula durante la sesión (no se pide el historial a Traccar).
- **Marcador SVG:** el aro y el halo llevan el estado de conexión: color (verde, gris o ámbar) **y forma** (aro continuo en línea, discontinuo sin conexión, punteado desconocido), de modo que no haga falta distinguir colores y la flecha la dirección (`course`). La rotación toma el camino corto (350° → 10° gira 20°, no 340°).
- **Movimiento y centrado:** el marcador se desliza 1,8 s con _easing_ entre posiciones (`requestAnimationFrame`) y el mapa lo mantiene en el centro, como pide el reto, sin botón de recentrar. El operador puede mirar alrededor (arrastrar o usar las flechas): el mapa vuelve al vehículo con suavidad en cuanto llega la siguiente posición, nunca en mitad del arrastre. El zoom (rueda, doble clic, pellizco) se hace siempre sobre el vehículo. Tras un silencio largo entre dos posiciones, el marcador salta en vez de "volar" (ver «Rastro del vehículo»).
- **Micro-interacciones:** la velocidad y la batería se animan hacia su nuevo valor y se resaltan con un realce suave que se desvanece; el texto relativo ("Hace 15 segundos") cambia con un fundido (en pasos de 5 s, para que no cambie cada segundo). Un cambio de **conexión** se anuncia con tres señales a la vez: el color del indicador se transiciona, su texto se funde y se resalta, y la zona de velocidad pasa con un fundido de "34 km/h" a "Sin señal · Última…" (o al revés), mientras el arco se vacía o se llena. El número nunca pasa por 0: una velocidad desconocida no es cero. "Batería baja" y "Detenido" también entran con un fundido. Todo respeta `prefers-reduced-motion`.
- **Tema claro/oscuro:** sigue al sistema (también en vivo, si cambia mientras la app está abierta) hasta que el usuario elige con el interruptor; solo esa elección explícita se guarda, para no "congelar" el tema del sistema como si fuera una decisión. Se aplica antes del primer pintado, sin destello, y el color de la barra del navegador (`theme-color`) se sincroniza con el de la cabecera. El mapa oscuro recolorea solo los _tiles_, no los marcadores ni los controles. El cambio se hace con un fundido de 250 ms de toda la pantalla (API de transiciones de vista; sin ella, o con movimiento reducido, es inmediato). El estado de React se cambia dentro de la transición y lee siempre el último valor pedido, de modo que dos clics seguidos nunca dejan la pantalla desincronizada.
- **Responsive:** dos maquetas. En **horizontal** (escritorio, portátil, tablet apaisada) hay dos columnas, con mapa y tarjeta siempre de la misma altura. En **vertical** (teléfonos y tablet en vertical) la tarjeta pasa a ser una **barra de estado compacta encima del mapa**: nombre, placa y estado arriba; velocidad a la izquierda y batería y hora a la derecha. El arco decorativo desaparece (el número es la velocidad) y el mapa ocupa todo el alto que queda, de modo que lo que un operador nunca debe tener que desplazarse para ver (qué vehículo es y a qué velocidad va) queda siempre en pantalla. Medido: a 375×667, 360×640 y 320×568 la velocidad se ve sin scroll (antes, a ≤ 667 px de alto quedaba por debajo del pliegue). A menos de 360 px las tres filas se apilan. En tablet vertical el mapa deja de ser una tira estrecha de 344×912 px.
- **El mapa móvil no se tapa:** en tablet y escritorio el estado del flujo flota sobre el mapa, arriba a la izquierda. En móvil el mapa es pequeño, así que ese estado y su botón ("Ver modo demostración" o "Volver a datos reales") pasan a una franja **encima** del mapa, en el flujo normal de la página. Durante la carga se reserva el hueco de esa franja para que no haya saltos de layout. En el mapa solo queda el zoom.

## Sistema de diseño

Tokens en CSS _custom properties_:

- [tokens.css](src/styles/tokens.css): tipografía (familias, tamaños, pesos, interlineado), escala de espaciado de 4 px, grosores de borde, radios, movimiento (duraciones y curva, incluidas las de los bucles decorativos), escala de `z-index`, el amarillo de la placa y los tamaños de objetivo táctil y de anillo de foco. Ningún componente escribe a mano un color, un tamaño de letra, un grosor de borde, un radio, un `z-index` ni una duración; solo quedan medidas de maquetación (alturas, anchos máximos) y trucos de accesibilidad como `visually-hidden` y los `0,01 ms` con los que `prefers-reduced-motion` anula el movimiento.
- [themes.css](src/styles/themes.css): paleta de color clara y oscura (16 tokens de color por tema; algunos valores coinciden a propósito, como el del foco y el del acento), sombras (tarjeta, ventana, cabecera) y filtros del mapa. Cada color documenta su ratio de contraste sobre la superficie donde se usa.
- [base.css](src/styles/base.css): reset, foco global, enlace de salto y `prefers-reduced-motion`.
- [overrides.css](src/styles/overrides.css): `forced-colors` (alto contraste de Windows) e impresión. Se importa **después** de todos los componentes, porque sus reglas tienen la misma especificidad y solo ganan por orden de carga.

## Accesibilidad (WCAG 2.1 AA)

- **Semántica:** la tarjeta usa `<section>` etiquetada, `<h2>` y listas de descripción (`<dl>`, `<dt>`, `<dd>`) para **todos** sus pares etiqueta-valor: Placa y Estado de conexión (con la etiqueta oculta visualmente, para que un lector de pantalla no oiga un "En línea" suelto), y Velocidad, Batería y Última actualización. Además `<time dateTime>`, `<header>`, `<main>`, `lang="es"` y un enlace "Saltar al contenido".
- **Teclado:** todo es operable con Tab, Espacio y Enter: selector de vehículo (`<select>` nativo), interruptor de tema (`role="switch"`), botones del flujo y de reintento, y los controles del mapa. Leaflet dibuja Acercar y Alejar como enlaces (`<a role="button">`), que solo responden a Enter; un manejador hace que **Espacio** también los active (sin desplazar la página). El mapa enfocado se mueve con las flechas y explica esto en una descripción oculta (`aria-describedby`). Los objetivos táctiles miden 44 px, o 32–36 px en móvil (por encima del mínimo de 24 px de WCAG 2.2).
- **Foco:** anillo de 3 px con `:focus-visible`, de contraste 6,1:1 en claro y 10,8:1 en oscuro sobre el fondo; el contorno sigue el radio de cada control. **El contorno de foco no se elimina en ningún elemento de la aplicación:** el título del mensaje de error, que recibe el foco por programa, usa el mismo anillo global. Sobre el mapa, los botones de zoom añaden un halo del color de la superficie, para que el anillo conserve su contraste sea cual sea el color de los tiles.
- **Lectores de pantalla:** región `aria-live` oculta que anuncia solo cambios relevantes (conexión, batería baja, saltos de velocidad de 10 km/h o más), no cada posición. El indicador de flujo es `role="status"`. El mapa es una región con nombre y el marcador una imagen con descripción (nombre, estado, velocidad y rumbo).
- **Color y daltonismo.** Criterios de WCAG 2.1: 1.4.1 (la información no depende solo del color), 1.4.3 (contraste del texto de 4,5:1 o más) y 1.4.11 (3:1 para elementos gráficos). En la práctica: el estado va siempre en punto **y texto** (conexión, flujo, resumen de flota, batería), "En línea" además **pulsa** (una pista de movimiento) y el marcador del mapa añade la **forma** del aro al color. La placa amarilla no depende del amarillo: lleva caracteres oscuros (11,4:1) y un borde oscuro, porque el amarillo solo contrasta 1,4:1 con el fondo claro. Verificado con una simulación de protanopia, deuteranopia y tritanopia (modelo de Machado et al.): sin forma ni texto, verde, ámbar y rojo se parecen mucho con protanopia y deuteranopia (diferencia de color ΔE entre 9 y 22, donde menos de 10 se confunde), por eso ningún estado se apoya solo en el tono. Es una simulación, no una prueba con personas daltónicas; conviene revisarlo también con "Emular deficiencias de visión" de las herramientas de desarrollo de Chrome. Texto de al menos 14 px.
- **Movimiento y centrado:** el marcador se desliza y el mapa lo sigue, pero el operador puede mirar alrededor con el ratón o con las flechas (ver «Decisiones de diseño»). Todo el movimiento se desactiva con `prefers-reduced-motion`.
- **Verificado:** axe-core (reglas WCAG 2.0, 2.1 y 2.2 A y AA, y buenas prácticas) sobre las 65 historias de Storybook en claro y oscuro, y sobre la app real en sus estados: sin violaciones. La única regla que salta, `landmark-unique`, es de una historia que dibuja cada tarjeta dos veces a propósito (claro y oscuro) y está desactivada solo allí. Contraste calculado de todo el texto visible (4,5:1, o 3:1 en texto grande) y de los bordes de controles (3:1). **Aún sin probar con un lector de pantalla real** (NVDA o VoiceOver).

## Storybook

Cada componente tiene _stories_ con todos sus estados (en línea, offline, batería baja, sin posición, sin vehículos, error, cargando, etc.): más de 60, con alternancia de tema y, en las de color con significado, claro y oscuro lado a lado. Incluye historias de regresión, como el cambio a un vehículo sin posición.

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
| `npm run build-storybook` | Genera Storybook estático en `storybook-static/` |
| `npm test` | Pruebas del Worker (`node:test`, sin dependencias) |
| `npm run typecheck:worker` | Comprueba los tipos del Worker |
| `npm run worker:dev` | Ejecuta el Worker en local con `wrangler` (necesita `worker/.dev.vars`) |
| `npm run worker:deploy` | Publica el Worker en Cloudflare |
| `npm run check:proxy -- <worker> <app>` | Comprueba desde fuera un Worker ya publicado |

## Estructura

```
src/
├── api/            Cliente de Traccar, simulador local, tipos, rutas de demostración y el «caminante» de rutas
├── components/     AppShell, StatusCard (medidor, batería, lectura de velocidad), Map (marcador, rastro),
│                   FeedStatus, FleetSummary, ErrorState, NoVehicles, Skeleton, DeviceSelector,
│                   ThemeToggle, ConnectionIndicator, LicensePlate, BrandMark (cada uno con su CSS y stories)
├── hooks/          useMonitor (ciclo de datos), useTheme, useNow, useTweenedNumber
├── styles/         tokens, temas, base y overrides (alto contraste e impresión)
└── utils/          unidades, tiempo relativo, estado y antigüedad de los datos, nombre del vehículo, movimiento
scripts/            Simulador de posiciones para Traccar y comprobación del proxy publicado
worker/             Proxy a Traccar para producción (Cloudflare Worker) y sus pruebas
.storybook/         Configuración de Storybook (alternancia de tema)
```

## Despliegue

La app se publica en **Vercel** (estática) y habla con Traccar a través de un **Worker de Cloudflare** ([worker/](worker/)). Todo cabe en los planes gratuitos y no pide tarjeta.

```
Navegador ──► Vercel (la app, HTML/JS/CSS)
   │
   └──────────► Cloudflare Worker ──► Traccar (demo4.traccar.org)
                  inicia la sesión,
                  reenvía REST y WebSocket
```

**Por qué hace falta un Worker.** Los servidores de demostración de Traccar no envían CORS, y los _rewrites_ de Vercel o Netlify no sirven para un WebSocket. El Worker resuelve las dos cosas y además **guarda la cuenta de Traccar como secreto**: el navegador no ve ni la contraseña ni la cookie de sesión (en la app solo se ve la llamada `POST /api/session`, que el Worker responde con `{"authenticated": true}` tras iniciar sesión de verdad en Traccar).

**Cómo se autentica el Worker.** Las llamadas REST llevan la cuenta como credenciales _Basic_ en cada petición, así que no dependen de que una sesión sobreviva de una llamada a la siguiente. Se descubrió al desplegar: Cloudflare puede enviar cada petición desde una IP distinta, y el servidor de demostración no reconocía la cookie de sesión de una a otra (el inicio de sesión funcionaba y la llamada siguiente daba 401). El WebSocket, que Traccar liga a una sesión y para el que ignora las credenciales _Basic_, es más delicado: el servidor **no devuelve un error** cuando no reconoce al cliente, responde un `200` vacío. El Worker prueba primero un **token de acceso** (lo pide con las credenciales _Basic_ y lo manda como `?token=`, así que tampoco necesita sesión) y, si el servidor no lo admite, una **cookie** de un inicio de sesión nuevo. **Verificado contra `demo4.traccar.org` (octubre de 2026): el token abre el socket y llegan datos reales.** Si ninguno de los dos intentos abre el socket, responde un `502` que dice qué probó y qué contestó cada intento (sin ningún valor secreto), y la app cae a _polling_ por REST y sigue funcionando.

**No es un proxy abierto.** Como entra a Traccar con tu cuenta, solo reenvía lo que la app necesita: `POST /api/session`, `GET /api/devices`, `GET /api/positions` y el WebSocket `/api/socket`. Cualquier otra ruta o método (crear o borrar dispositivos, leer usuarios…) devuelve 404 o 405 sin llegar a Traccar. Responde con CORS solo a los orígenes de `ALLOWED_ORIGINS` y, en el WebSocket, rechaza un `Origin` ajeno. Esto limita qué puede hacer cualquiera con la URL del Worker, pero **no** la oculta: cualquiera puede leer los datos de esa cuenta de demostración (que son datos simulados).

### Paso a paso

1. **Worker (Cloudflare).** Crea una cuenta gratuita en <https://dash.cloudflare.com/sign-up> y, desde la carpeta del proyecto:
   ```bash
   npx wrangler login                      # abre el navegador para autorizar
   npm run worker:deploy                   # publica y muestra la URL del Worker
   npx wrangler secret put TRACCAR_EMAIL    --config worker/wrangler.jsonc
   npx wrangler secret put TRACCAR_PASSWORD --config worker/wrangler.jsonc
   ```
   Los dos últimos comandos te piden el valor por la terminal: no lo escribas en ningún archivo ni en un chat. La primera vez, Cloudflare te pide elegir un subdominio `workers.dev`. La URL queda como `https://rumbo-proxy.<tu-subdominio>.workers.dev`.
2. **App (Vercel).** En <https://vercel.com/new> importa el repositorio de GitHub. Vercel detecta Vite; en _Environment Variables_ añade:

   | Variable | Valor |
   | --- | --- |
   | `VITE_USE_MOCK` | `false` |
   | `VITE_TRACCAR_BASE` | la URL del Worker, sin `/` final |

   **No pongas** `VITE_TRACCAR_EMAIL` ni `VITE_TRACCAR_PASSWORD` en Vercel: la cuenta vive en el Worker. Despliega y copia la URL de producción (por ejemplo `https://rumbo-monitor.vercel.app`).
3. **Autoriza el origen de la app.** Edita `ALLOWED_ORIGINS` en [worker/wrangler.jsonc](worker/wrangler.jsonc) con esa URL, **exacta y sin `/` final** (puedes dejar también `http://localhost:5173`), y vuelve a publicar con `npm run worker:deploy`. Los secretos se conservan. Solo la URL de producción queda autorizada: las URL de vista previa de Vercel (`...-git-rama-...vercel.app`) no.
4. **Comprueba.**
   ```bash
   npm run check:proxy -- https://rumbo-proxy.<tu-subdominio>.workers.dev https://rumbo-monitor.vercel.app
   ```
   Prueba, desde fuera, el inicio de sesión, la lista de dispositivos, el CORS, que se rechacen un origen ajeno y las rutas prohibidas, y el apretón de manos del WebSocket. Después abre la URL de la app y mira que el indicador diga «Datos en vivo».

### Para que haya datos que ver

La app muestra lo que haya en Traccar: **si el simulador no está enviando posiciones, quien la abra verá posiciones viejas** (y el aviso «Sin datos nuevos», con el modo demostración a un clic). Para una evaluación en vivo, deja `npm run simulate` corriendo mientras tanto, teniendo en cuenta el presupuesto diario de posiciones (ver [Simulador](#simulador-de-datos-para-traccar)).

### Probar el Worker en local

```bash
cp worker/.dev.vars.example worker/.dev.vars   # y completa TRACCAR_EMAIL y TRACCAR_PASSWORD
npm run worker:dev                              # http://127.0.0.1:8787
```

Con `VITE_TRACCAR_BASE=http://127.0.0.1:8787` y `http://localhost:5173` en `ALLOWED_ORIGINS`, `npm run dev` usa el Worker en lugar del proxy de Vite. `npm test` ejecuta las 22 pruebas del Worker sin red (Traccar simulado): lista de rutas permitidas, CORS, REST que funciona aunque Traccar no reconozca nunca la cookie, WebSocket con token (compartido entre conexiones simultáneas) y con cookie como respaldo, renovación de una sesión caducada, un `502` que explica cada intento fallido sin revelar valores, y control de origen del WebSocket. El WebSocket de extremo a extremo se probó además sobre `workerd`, el motor real de Cloudflare.

### Límites del plan gratuito

El plan gratuito de Workers admite 100.000 peticiones al día (consulta los límites actuales en Cloudflare). Con el WebSocket funcionando, cada visitante hace unas pocas; si el WebSocket cayera y la app pasara a _polling_, serían unas 17.000 al día por pestaña abierta.

## Notas y límites conocidos

- Los _tiles_ de OpenStreetMap sirven para una demostración, pero su [política de uso](https://operations.osmfoundation.org/policies/tiles/) no cubre tráfico real; para eso, configura `VITE_TILE_URL` con un proveedor con clave.
- Los servidores públicos de Traccar son compartidos: pueden caerse un momento o limitar el almacenamiento (ver el presupuesto del simulador).
- **Los datos «en vivo» dependen de que algo envíe posiciones a Traccar** (ver [por qué existe el simulador](#simulador-de-datos-para-traccar)). Si nadie lo hace, la app lo dice con honestidad («Sin datos nuevos») y ofrece el modo demostración.
- El WebSocket depende de que el servidor admita _tokens_ de acceso o sesiones (se verificó contra `demo4`). Si no pudiera abrirse, la app sigue funcionando con _polling_.
- La antigüedad de una posición ("sin datos nuevos") se calcula con el reloj del navegador. Si el equipo del operador va desfasado más de 2 minutos respecto al servidor, los datos pueden verse como viejos aunque lleguen en vivo, o al revés.
- Hay pruebas automáticas del Worker (`npm test`), pero no de la interfaz: esa se verifica con Storybook, axe-core y revisión manual.

## Uso de IA

> Borrador: revisa y ajusta con tus propias palabras antes de entregar.

Usé IA como copiloto en tres frentes; la dirección de arte, la verificación y las decisiones de producto las tomé yo.

- **Diseño.** Generé el diseño con Google Stitch a partir de un prompt. La primera versión no sirvió: añadía datos que Traccar no entrega (combustible, odómetro, presión de neumáticos…), un fondo oscuro cansado y demasiado texto. Rehíce el prompt con una lista explícita de lo que **no** debía aparecer. Más tarde usé v0 solo para explorar una dirección visual (arco de velocidad y barra de batería segmentada) que llevé a mi propio CSS, en lugar de copiar su código.
- **Código.** Claude Code escribió el esqueleto (cliente de Traccar, simulador, componentes, Storybook) y yo lo revisé en el navegador, en claro y oscuro y en varias resoluciones.
- **Verificación.** Pedí auditar con axe-core, calcular contrastes y probar con teclado; no me bastó que «compilara».

Lo que hubo que corregir porque no cumplía:

- La IA propuso **CARTO** como mapa sobrio; al probarlo exigía clave de API y dibujaba una marca de agua, así que lo descarté y mantuve OpenStreetMap.
- El simulador inicial movía los vehículos **en círculos matemáticos**, por encima del agua y los edificios. Lo cambié por rutas reales por calles.
- Los números de velocidad y batería **saltaban de golpe**; ahora se animan hacia su valor y se resaltan con suavidad.
- Una tarjeta **flotante** sobre el mapa en móvil tapaba el marcador y los controles: pasó a una disposición en flujo normal.
- El estado decía «En vivo» con una posición de **7 horas** de antigüedad: «conectado» no es «fresco». Lo separé y añadí el aviso de datos viejos, con un modo demostración siempre rotulado.
- Al cambiar a un vehículo sin posición, el mapa **conservaba el marcador del anterior** bajo el nombre del nuevo (lo detecté revisando el código y lo reproduje con una historia de regresión antes de arreglarlo).
- El primer Worker autenticaba con una cookie de sesión y funcionaba en local, pero **fallaba en producción**: Cloudflare envía cada petición desde una IP distinta y el servidor de demostración no reconocía la sesión de una a otra. Lo detectó una comprobación automática que hice desde fuera (`npm run check:proxy`), no la revisión del código; lo cambié a credenciales _Basic_ por llamada y, para el WebSocket, a un _token_ de acceso.
- Cuando Traccar dejó de guardar posiciones, el primer diagnóstico (un tope por cuenta) estaba **equivocado**; lo corregí cruzando los datos reales (dos bloques de exactamente 1.500 posiciones por vehículo) con lo que dicen los foros de Traccar.
