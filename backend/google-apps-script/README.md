# Agenda de reservas con Google Calendar

Este backend de Google Apps Script sirve una agenda personalizada y crea eventos privados en un calendario de Google. El sitio estático nunca recibe el ID del calendario ni credenciales de Google.

## Antes de publicar

`Code.gs` está configurado con el horario que ya aparece en el sitio: lunes a sábado, de 9:00 a. m. a 9:00 p. m., en `America/Bogota`. Cada espacio bloquea 60 minutos, se exige una anticipación mínima de 2 horas y se muestran fechas hasta 120 días adelante. Confirma que esas reglas representan el servicio real antes de desplegar. Se ajustan al inicio de `Code.gs`.

La captura de configuración compartida confirma el ID del calendario principal. Ese ID puede usarse para que esta aplicación consulte disponibilidad y guarde reservas en el calendario principal, siempre que la cuenta propietaria autorice Apps Script.

La agenda pública existente se llama “Taxi dancer” y en Google Calendar también aparece `taxiDancerCalendario`. Antes de activar la agenda personalizada, confirma dónde se guardan las citas hechas desde “Taxi dancer”. Si están en `taxiDancerCalendario` y no en el calendario principal, esta versión no las verá: el backend actual consulta y escribe en un solo calendario. En ese caso, mantén la agenda existente como opción principal hasta ampliar el backend para revisar ambos calendarios. No uses un calendario importado como destino para crear reservas.

El ID del calendario no es una contraseña, pero debe configurarse solo como propiedad del proyecto de Apps Script; no lo añadas a archivos públicos del sitio.

## Crear y desplegar la aplicación

1. Abre [script.google.com](https://script.google.com/) con la cuenta que administra el calendario y crea un proyecto independiente.
2. En **Configuración del proyecto**, activa **Mostrar el archivo de manifiesto `appsscript.json` en el editor**. Copia `Code.gs` y `Booking.html` de esta carpeta al proyecto de Apps Script y reemplaza el manifiesto por `appsscript.json`.
3. En **Configuración del proyecto → Propiedades del script**, agrega estas propiedades:
   - `BOOKING_CALENDAR_ID`: el ID que aparece en Google Calendar en **Configuración → Integrar calendario**. Usa el valor de la captura del calendario principal, no la URL pública ni la dirección iCal secreta.
   - `BOOKING_SITE_ORIGIN`: el origen HTTPS donde está publicado el sitio, por ejemplo `https://usuario.github.io` o el dominio propio. No incluyas rutas, el nombre del repositorio ni una barra al final. Si todavía no conoces la dirección pública del sitio, espera antes de completar esta propiedad.
4. La zona horaria que aparece en la captura de Apps Script es la de Colombia. Confirma que el calendario de destino también use **America/Bogota**.
5. Antes de implementar, verifica que todas las citas existentes que deban bloquear horarios estén visibles en el calendario indicado por `BOOKING_CALENDAR_ID`. La aplicación no consulta automáticamente los otros calendarios visibles en tu cuenta.
6. En **Implementar → Nueva implementación → Aplicación web**, selecciona **Ejecutar como: yo**. Para que el público pueda consultar y solicitar reservas, el acceso debe permitir a cualquier visitante. Google podría pedir autorización para administrar eventos del calendario.
7. Implementa y copia la URL terminada en `/exec`.
8. Pega esa URL en `window.BOOKING_APP_URL` dentro de `assets/js/booking-config.js` y publica el cambio del sitio estático.
9. Prueba una fecha libre, intenta reservarla dos veces y verifica que aparezca un evento privado de 60 minutos en el calendario seleccionado. Comprueba también que un evento existente impida reservar ese horario.

Si la organización de Google Workspace no permite aplicaciones accesibles a visitantes, solicita al administrador que autorice esta implementación. Hasta conectar y publicar la aplicación, el sitio conserva un enlace y la agenda de citas de Google existente como alternativa.

## Privacidad y límites

- El servidor devuelve únicamente fechas y horas libres, nunca títulos, participantes ni descripciones de eventos existentes.
- Las solicitudes válidas crean un evento **privado** y la confirmación indica que queda pendiente de confirmación de Juan.
- El servidor comprueba nuevamente el horario al reservar y usa un bloqueo para evitar dos reservas simultáneas. También valida los campos, aplica una pausa breve por número de teléfono y usa un campo trampa para bots.
- Al permitir que Google Apps Script se muestre dentro del sitio, la aplicación verifica un mensaje del origen configurado en `BOOKING_SITE_ORIGIN` antes de mostrar o consultar el calendario. En una pestaña propia funciona directamente; en una incrustación desde otro origen, no muestra la agenda.
- La aplicación es pública y crea eventos en el calendario de su propietario. No guardes secretos en el HTML o JavaScript del sitio. Para una publicación con mayor riesgo de abuso, añade un CAPTCHA y monitoriza los registros de Apps Script.
- La duración de reserva actualmente es fija en 60 minutos. Si necesitas duraciones distintas, confirma la regla comercial antes de cambiar el código.

La implementación de Apps Script se despliega por separado del sitio estático; el código fuente permanece versionado en esta carpeta. La URL `/exec` es un identificador de despliegue, no una credencial de acceso al calendario.
