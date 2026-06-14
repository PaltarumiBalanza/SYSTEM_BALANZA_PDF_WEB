1. El Prompt:
Rol: Actúa como un Senior Product Designer (UX/UI) y Project Manager experto en sistemas industriales/mineros.

Tarea: Diseñar la arquitectura de información y el prototipo High-Fidelity (Figma style) para "PDF Mining Web Hub", una extensión web de un software de escritorio existente.

Contexto: El sistema original hace web scraping de datos de balanzas mineras y genera PDFs. El módulo web debe centralizar estos archivos para que usuarios de distintas regiones (Lima, Antamina, etc.) puedan gestionarlos, editarlos y autorizarlos.

Requerimientos Funcionales:

Auth: Login con roles (Administrador, Supervisor de Región, Operador).

Dashboard de Gestión: Tabla avanzada con filtros por estado (Pendiente, Procesado, Error), fecha, región y usuario creador.

Editor Light de PDF: Interfaz intuitiva para visualizar miniaturas de páginas, arrastrar para reordenar, y botones para "Insertar Hoja (Inicio/Fin)" o "Eliminar seleccionadas".

Trazabilidad: Sección de historial para ver quién editó qué y cuándo (basado en metadata JSON).

Estilo Visual: Interfaz "Industrial Dark Mode" o "Clean Enterprise", enfocada en la legibilidad de datos, usando una paleta de colores que denote seguridad y precisión (Azules industriales, grises y estados de alerta claros).

Entregable esperado: > - Mapa de sitio (Sitemap).

Flujo de usuario (User Flow) desde que el PDF sube del sistema de escritorio hasta que se marca como "Hecho".

Descripción detallada de los componentes UI necesarios.

2. Plan de Proyecto: PDF Mining Web Hub
Como Gestor de Proyectos, he estructurado el desarrollo en 4 fases para que sea manejable:

Fase 1: UX & Arquitectura (Semana 1)
Definición de Roles:

Operador: Solo sube y ve sus archivos.

Supervisor: Edita PDFs y aprueba estados de su región.

Admin: Gestiona usuarios y ve todas las regiones.

User Flow: El sistema de escritorio envía el PDF -> El usuario recibe notificación en la Web -> Entra a editar/revisar -> Cambia estado a "Hecho" -> Archivo disponible para descarga regional.

Fase 2: Diseño UI (Semana 2)
Pantalla de Login: Simple, con validación de seguridad.

Panel Principal (FileManager): Vista de "Tarjetas" o "Lista" con indicadores visuales de estado (ej. un punto naranja para "Pendiente", verde para "Hecho").

Módulo de Edición: Una vista dividida. A la izquierda, el visor de PDF; a la derecha, un panel de "Acciones" (Subir anexo, Borrar página, Unir con otro reporte).

Fase 3: Integración y Lógica (Semana 3-4)
Sincronización: Definir el "Webhook" que recibirá el PDF desde tu app de escritorio.

3. Ideas "Plus" para impresionar a tu cliente
Para que el sistema sea de "clase mundial", te sugiero incluir estos dos puntos en el diseño:

Firma Digital Simple: Un botón para que el supervisor estampe una "Firma de Revisado" visual en la primera página del PDF antes de pasarlo a "Hecho".

Notificaciones Push/Email: Que el sistema avise al supervisor de Lima cuando un nuevo reporte de balanza ha sido generado en la mina.

Logs de Actividad: Una sección donde se vea: "Elías Carmín agregó 2 páginas al Reporte_001 a las 10:45 AM".

Utiliza paleta de colores y el logo de paltarumi.png qu está en la carpeta raíz del proyecto.

Por ahora solo funcionalidades sin backend, eso mas tarde lo brindo. quiero datos de ejemplos para ver como funcionaría el sistema