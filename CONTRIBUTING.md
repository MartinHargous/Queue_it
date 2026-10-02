# Cómo contribuir

## Protocolo de cambios

Todo cambio se clasifica con uno de tres tipos. El mismo tipo se usa en la rama, en los commits y en el pull request.

| Tipo | Cuándo |
|---|---|
| `FEAT` | Funcionalidad nueva que el usuario puede usar (listas de reproducción, cuenta inicial…). |
| `FIX` | Corrección de algo que no funciona como debería (un botón que hace otra cosa, un cálculo erróneo…). |
| `UPDATE` | Cambio o mejora de algo que ya existe y no es un error: textos, traducciones, estilos, rendimiento, refactor, documentación, dependencias, configuración. |

### Ramas

`tipo/descripcion-corta`, en minúsculas y con guiones, saliendo siempre de `main`:

```
feat/setlists
fix/export-share-button
update/translations
```

Una rama = un cambio. Si aparece otro tema mientras trabajas, va en otra rama.

### Commits

```
TIPO: Resumen en imperativo (máx. ~72 caracteres)

Por qué hacía falta y qué cambia, en pocas líneas.
```

Ejemplos:

```
FEAT: Agregar listas de reproducción
FIX: Compartir abre el menú del sistema al exportar
UPDATE: Revisar traducciones de inglés y portugués
```

Cada commit es **atómico y autocontenido**:

- Hace una sola cosa. Si el resumen necesita un "y", probablemente son dos commits.
- Por sí solo compila y pasa `npm run lint` y `npm test`. Nada de commits "a medias" que se arreglan en el siguiente.
- Incluye lo que el cambio necesita para estar completo: tests, traducciones (`src/lib/i18n/`) y la parte de `ARCHITECTURE.md` que describe ese comportamiento.

### Pull requests

- Título igual al commit principal: `TIPO: Resumen`.
- Un tema por PR, desde su propia rama `tipo/...` hacia `main`.
- Descripción con tres partes: **Qué cambia**, **Por qué** y **Verificación** (qué se corrió y qué se probó a mano).
- Antes de abrirlo: `npm run lint`, `npm test` y `npm run build` deben pasar.

El workflow `Protocolo de cambios` revisa en cada PR que el título y el nombre de la rama sigan este formato.
