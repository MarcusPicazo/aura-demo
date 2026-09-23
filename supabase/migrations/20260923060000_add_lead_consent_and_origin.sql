-- Aviso de privacidad (LFPDPPP): registra el origen del lead y, cuando viene del
-- formulario de contacto, la marca de consentimiento con su fecha. `origin` es not null
-- porque todo lead nuevo declara de dónde viene; `consent_at` es nullable porque el botón
-- "Me interesa" (origin = 'whatsapp') no pasa por el formulario con la casilla.
alter table leads
  add column origin text not null default 'form' check (origin in ('whatsapp', 'form')),
  add column consent_at timestamptz;

-- Las políticas de RLS existentes (insert público, select solo autenticados) ya cubren
-- estas columnas: no aplica a nivel de columna, solo de fila.
