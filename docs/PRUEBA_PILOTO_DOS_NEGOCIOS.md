# Prueba piloto con dos negocios ficticios

Esta prueba sirve para encontrar fallos antes de ofrecer el sistema a negocios
reales. Usa exclusivamente los dos accesos de prueba y datos inventados. No
incluyas nombres, teléfonos, documentos ni información financiera de clientes
reales.

## Antes de empezar

- Confirma que estás entrando al sitio correcto: `sistema-rest-gbxt.vercel.app`.
- Usa una ventana de navegador distinta o un perfil separado para cada negocio.
  Identifica cuál ventana corresponde al Negocio A y cuál al Negocio B.
- Anota qué navegador y dispositivo usas, el día y la hora aproximada de cada
  prueba.
- Crea un identificador ficticio fácil de buscar, por ejemplo `PILOTO-A-03OCT`
  y `PILOTO-B-03OCT`. Úsalo en nombres de productos o conceptos de gasto, no
  como nombre o documento de un cliente.
- No borres cierres, datos de configuración ni usuarios para “limpiar” las
  pruebas. Si necesitas reiniciar, anota qué quieres limpiar y pide ayuda.
- Al guardar una venta o gasto durante una conexión lenta, no pulses guardar
  varias veces. Primero actualiza la pantalla y revisa si la operación aparece;
  solo vuelve a intentarlo si confirmas que no se registró.
- Si un resultado podría duplicar una venta, alterar un cierre o mezclar
  negocios, detén esa prueba y anota lo que ocurrió.

## Registro de resultados

Por cada prueba, anota:

| Campo | Qué escribir |
|---|---|
| Día y hora | Momento aproximado |
| Negocio y usuario | A o B; administrador o mesero |
| Acción | Qué intentabas hacer |
| Resultado esperado | Qué debía ocurrir |
| Resultado observado | Qué ocurrió realmente, con el texto exacto del error |
| Repetición | Si pasó una vez o se repitió |
| Evidencia | Captura sin credenciales ni información personal |

No compartas contraseñas, códigos de acceso, enlaces de recuperación ni
capturas que expongan información privada.

## Día 1: accesos y separación de negocios

1. Inicia sesión en A y B en ventanas separadas. Comprueba que cada una muestre
   el nombre del local correcto.
2. En A, crea un producto de prueba `PILOTO-A-03OCT`; en B, crea
   `PILOTO-B-03OCT`. Usa precios ficticios bajos.
3. Cierra sesión en A y vuelve a ingresar. Comprueba que el producto de A siga
   allí y que no se haya cambiado la sesión abierta de B.
4. En A, revisa productos, mesas, inventario, ventas, gastos e historial.
   Comprueba que no aparezcan los registros identificados como propios de B.
   Repite la comprobación desde B.
5. En cada negocio, cambia el color o fondo si quieres comprobar la
   personalización. Verifica que la preferencia de A no cambie la de B en el
   mismo navegador. La preferencia es local al navegador/dispositivo.

**Éxito:** los accesos no se confunden y cada negocio ve únicamente sus
registros. Si aparece un dato del otro negocio, cierra esa sesión y no sigas
registrando operaciones; anota el caso y avisa.

## Día 2: personal, permisos y pedidos

1. Si hay un usuario de mesero de prueba, inicia sesión como ese mesero en una
   tercera ventana privada.
2. Comprueba que pueda consultar mesas y crear/editar pedidos según el flujo
   permitido.
3. Comprueba que no vea historial financiero, gastos, configuración,
   productos/costos o administración de usuarios.
4. Intenta abrir las pantallas administrativas usando solo los controles
   normales de la aplicación; no ejecutes SQL ni uses herramientas para
   modificar registros de otro negocio.
5. Desde la cuenta administradora, crea un pedido ficticio, actualízalo y
   comprueba que el cambio aparezca en la otra ventana sin volver a guardar.

**Éxito:** el mesero puede hacer el trabajo asignado, no ve administración y
los cambios de pedido aparecen correctamente. No elimines el usuario de prueba
como parte de esta comprobación.

## Día 3: ventas, gastos y cierre de caja

En A, realiza un turno ficticio completo:

1. Abre un turno con una base inventada, por ejemplo **COP 50.000**.
2. Registra una venta de **COP 20.000 en efectivo**, otra de
   **COP 15.000 con tarjeta** y otra de **COP 10.000 por transferencia**.
3. Registra un gasto de **COP 5.000 en efectivo** y uno de
   **COP 2.000 por transferencia**.
4. Antes de cerrar, comprueba los totales. El efectivo esperado para contar
   debe ser COP 65.000 (base 50.000 + venta en efectivo 20.000 - gasto en
   efectivo 5.000); la tarjeta neta COP 15.000 y la transferencia neta
   COP 8.000.
5. Usa esas cantidades como conteo físico de prueba y cierra el turno.
6. Revisa el historial: las ventas y los gastos deben quedar vinculados a ese
   cierre y no deben aparecer como actividad de un turno abierto.
7. Recarga la página e inicia sesión de nuevo. Comprueba que el cierre sigue
   en el historial y conserva las mismas cifras.
8. Abre B y confirma que no ve las transacciones ni el cierre de A.

**Éxito:** las sumas son correctas, cada operación queda en el turno esperado,
y el historial persiste tras recargar. Las cantidades son solo ejemplos:
puedes elegir otras, pero calcula el resultado antes del cierre.

## Día 4: inventario, reportes y recuperación de sesión

1. En A, crea uno o dos insumos ficticios, registra existencias iniciales,
   entradas y un conteo final. Comprueba que la diferencia calculada coincida
   con lo que esperabas.
2. Prueba guardar el inventario del turno y comprueba que no se permita
   sobrescribir un inventario ya bloqueado.
3. Exporta ventas, gastos e inventario a PDF; confirma que el documento
   contiene datos y no solo una página vacía.
4. Recarga la página durante una consulta, no durante el envío de un cobro.
   Comprueba que la sesión y los datos vuelvan a cargar.
5. Si quieres probar pérdida de conexión, hazlo primero en una operación no
   financiera. Para una venta, si la red falla durante el envío, espera a que
   la pantalla se estabilice, actualiza y busca la venta antes de reintentar.

**Éxito:** los datos del inventario y PDFs coinciden con lo guardado y una
recarga no borra el historial.

## Día 5: revisar el historial y resumir

1. Vuelve a revisar A y B; confirma que cada negocio conserva sus productos,
   pedidos, operaciones e historial propios.
2. En el historial de un turno cerrado, comprueba que los cierres se puedan
   consultar y que la interfaz no ofrezca eliminarlos ni modificar sus ventas
   o gastos.
3. Prueba logout y login de ambos administradores y del mesero, si lo hay.
4. Anota errores, demoras, pasos confusos y cualquier diferencia entre lo
   esperado y lo observado.
5. Antes de iniciar otro turno, confirma que el turno anterior esté cerrado y
   que la pantalla muestre el nuevo estado correctamente.

## Casos que no se deben probar sobre el proyecto activo

- No ejecutar restauraciones, borrados masivos ni consultas SQL de escritura.
- No intentar cambiar manualmente el `user_id` ni reasignar filas a otro
  negocio.
- No borrar usuarios, perfiles o cierres para limpiar el piloto.
- No enviar el formulario de cobro repetidamente para “probar duplicados”.
- No usar datos personales reales ni prometer facturación electrónica.

La prueba de restauración debe hacerse en un proyecto Supabase separado, vacío
y preparado para pruebas. El proyecto activo reúne los datos de ambos negocios;
restaurar allí puede reemplazar o duplicar información.

## Criterio para ampliar después del piloto

No amplíes a más restaurantes hasta revisar los resultados de los cinco días,
resolver cualquier mezcla de datos o duplicación, confirmar que caja e
inventario cuadran, y probar por separado una restauración de respaldo. Un
resultado satisfactorio en la interfaz no sustituye una comprobación de
permisos en Supabase ni un simulacro de recuperación.
