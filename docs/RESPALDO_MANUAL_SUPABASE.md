# Respaldo manual de datos

Este procedimiento no tiene costo adicional de Supabase y genera copias del
esquema y de los datos de las tablas de RestoPOS. No es un respaldo automático
ni sustituye los respaldos administrados de Supabase.

## Crear una copia

1. Instala la CLI de Supabase y autentícate desde tu computadora.
2. En el panel de Supabase, abre el proyecto correcto y copia su referencia.
3. En PowerShell, ejecuta lo siguiente y reemplaza `REFERENCIA_DEL_PROYECTO`.
   La CLI pedirá la contraseña de la base de datos; no la escribas en el
   comando ni la compartas.

```powershell
$projectRef = "REFERENCIA_DEL_PROYECTO"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $env:USERPROFILE "Documents\RestoPOS-Respaldos\$projectRef\$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

npx.cmd --yes supabase@latest db dump --project-ref $projectRef --schema public --file (Join-Path $backupDir "schema.sql")
if ($LASTEXITCODE -ne 0) { throw "Falló el respaldo del esquema." }

npx.cmd --yes supabase@latest db dump --project-ref $projectRef --schema public --data-only --use-copy --file (Join-Path $backupDir "data.sql")
if ($LASTEXITCODE -ne 0) { throw "Falló el respaldo de los datos." }

Get-ChildItem $backupDir | Select-Object Name, Length, LastWriteTime
```

Haz una copia adicional de esa carpeta en un medio privado y protegido. Los
archivos contienen información de ventas, clientes e inventario. No los subas
a GitHub, no los envíes por correo y no los guardes en una carpeta pública.

Programa un recordatorio para repetirlo con la frecuencia que el negocio
necesite y antes de cambios importantes. Verifica que ambos archivos existan y
no estén vacíos. Un archivo generado no es una prueba de restauración.

## Exportar reportes operativos a PDF

- En **Ventas > Historial de Ventas**, selecciona el turno y usa **Guardar ventas
  como PDF** o **Guardar gastos como PDF**.
- En **Inventario**, después de guardar el inventario final, usa **Guardar
  inventario como PDF**.
- En el diálogo de impresión del navegador, selecciona **Guardar como PDF**.

Estos reportes son exportaciones manuales para consulta; no sustituyen el
respaldo de la base de datos. Contienen información operativa del negocio,
así que almacénalos en una ubicación privada y protegida.

## Restaurar datos

La restauración puede reemplazar o duplicar datos si se ejecuta sobre una base
que ya contiene registros. No la hagas directamente sobre el negocio activo.
Primero prepara un proyecto de prueba y confirma que tienes su contraseña de
base de datos y acceso a `psql`.

Para restaurar el esquema y los datos en una base vacía compatible:

```powershell
psql "CADENA_DE_CONEXION_DEL_PROYECTO_DE_PRUEBA" -v ON_ERROR_STOP=1 -f ".\schema.sql"
if ($LASTEXITCODE -ne 0) { throw "Falló la restauración del esquema." }

psql "CADENA_DE_CONEXION_DEL_PROYECTO_DE_PRUEBA" -v ON_ERROR_STOP=1 -f ".\data.sql"
if ($LASTEXITCODE -ne 0) { throw "Falló la restauración de los datos." }
```

Obtén la cadena de conexión desde el panel de Supabase y mantenla solo en tu
computadora. Nunca la guardes en este repositorio ni la compartas por chat.
Después de restaurar, verifica tablas, cantidades, cierres, políticas RLS y
flujos de acceso antes de usar ese proyecto con datos operativos.

## Límites importantes

- Estas copias incluyen el esquema y los datos del esquema `public`; no son una
  imagen completa del proyecto Supabase.
- No contienen contraseñas ni identidades de Supabase Auth. Si se pierde o se
  elimina el proyecto de autenticación, los usuarios deben volver a crearse y
  relacionarse de forma controlada; esta copia no puede recuperar sus claves.
- No incluyen archivos de Storage ni garantizan recuperación punto en el
  tiempo.
- La restauración solo conserva relaciones con `auth.users` cuando esas
  identidades siguen existiendo con los mismos identificadores en el proyecto
  de destino. Por eso una restauración en un proyecto vacío debe probarse y
  preparar las cuentas antes de cargar los datos.
- No se ha probado una restauración real en este procedimiento. Hasta que se
  ejecute y valide un simulacro, no se debe considerar probado el plan de
  recuperación.
- Los respaldos automáticos administrados y la recuperación punto en el tiempo
  dependen de las funciones y el plan vigente de Supabase; no se activan aquí.
