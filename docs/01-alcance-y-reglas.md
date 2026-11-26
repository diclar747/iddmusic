# Alcance funcional y reglas de negocio
## Identidad
Nombre de trabajo: **IDD Music** (confirmar si la marca final será IDB Music). Iglesia de Dios – Bella Vista. Símbolo institucional recibido: emblema circular con tres llamas. Paleta: azul marino, blanco y dorado.

## Alcance confirmado
- Una sola congregación.
- Acceso solo a miembros invitados/aprobados.
- Letras con acordes y partituras tradicionales.
- PWA instalable.
- Instalación mediante Docker.

## Módulos
Inicio, biblioteca, búsqueda de letras, detalle de canción, editor, transposición, partituras/PDF, importación de imagen/PDF, grupos, repertorios, perfil, notificaciones y administración.

## Roles
super_admin, music_admin, worship_director, editor, member. El backend es la autoridad para permisos.

## Estados de canción
draft, review, published, archived. Solo published aparece en la biblioteca común de miembros.
