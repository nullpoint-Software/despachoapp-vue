# Agnes es un proyecto independiente

El código fuente ahora está en `../../AgnesPrinterPlugin`, junto a DespachoApp.
Esta carpeta solo conserva los adaptadores de compilación y prueba.

- `powershell -File local-printer/build.ps1` compila el proyecto hermano y copia
  `AgnesPrinterPlugin-1.2.zip` a `public/printing`.
- `powershell -File local-printer/test.ps1` ejecuta las pruebas nativas del proyecto.
- Ambos scripts aceptan `-AgnesProject <ruta>` si el código está en otra ubicación.

Para reutilizarlo en otras apps, consultar el README y el SDK del proyecto Agnes.
