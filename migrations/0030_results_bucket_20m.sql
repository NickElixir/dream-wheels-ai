-- Миграция 0030: расширить bucket results для Wan 2.7 output.
--
-- Global Supabase Storage file-size limit должен быть выставлен не ниже
-- 20 MiB до применения этой миграции. Изображения не перекодируются:
-- сохраняются исходные bytes, полученные от provider.

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'results';
