# Seguridad, límites y pendientes
Este MVP no debe considerarse listo para producción.
- Revisar y probar JWT, expiración, revocación y almacenamiento del token.
- Añadir invitaciones de un solo uso y flujo de aprobación.
- Proteger descargas por propiedad/pertenencia y no servir archivos por ruta estática sin control adicional.
- Validar MIME real y extensión, analizar archivos y limitar cuotas.
- Implementar política de contraseñas, recuperación, MFA opcional y bloqueo por intentos.
- Añadir CSRF si se migra a cookies, CSP, logs estructurados y auditoría.
- Añadir tests unitarios, integración, e2e y pruebas de carga.
- Implementar OCR para letras y OMR para notación; ambos deben requerir revisión humana.
- Implementar transposición con pruebas de tonalidades y acordes complejos (slash chords, cifrado latino, modos).
- Completar offline con IndexedDB, descargas explícitas y sincronización con control de conflictos.
