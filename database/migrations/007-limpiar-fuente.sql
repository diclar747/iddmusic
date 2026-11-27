-- Quita de las notas de las canciones la línea "Fuente: https://…lacuerda.net/…" que se guardaba al importar.
UPDATE songs
SET notes = NULLIF(btrim(regexp_replace(notes, '\s*Fuente:\s*https?://\S*lacuerda\.net\S*\s*', E'\n', 'gi'), E' \n\r\t'), ''),
    updated_at = now()
WHERE notes ~* 'lacuerda\.net';
