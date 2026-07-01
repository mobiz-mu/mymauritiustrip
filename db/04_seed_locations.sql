-- =====================================================================
-- 04_seed_locations.sql
-- Mauritius tourist locations (matches the SEO location pages in the spec).
-- Categories and currency_settings are already seeded in 01_schema.sql.
-- =====================================================================

insert into locations (slug, name, region, latitude, longitude) values
  ('grand-baie',      'Grand Baie',      'North',  -20.0136, 57.5800),
  ('pereybere',       'Pereybère',       'North',  -20.0000, 57.5900),
  ('trou-aux-biches', 'Trou aux Biches', 'North',  -20.0333, 57.5450),
  ('flic-en-flac',    'Flic en Flac',    'West',   -20.2747, 57.3697),
  ('tamarin',         'Tamarin',         'West',   -20.3258, 57.3719),
  ('black-river',     'Black River',     'West',   -20.3600, 57.3700),
  ('le-morne',        'Le Morne',        'South-West', -20.4564, 57.3122),
  ('belle-mare',      'Belle Mare',      'East',   -20.1900, 57.7700),
  ('blue-bay',        'Blue Bay',        'South-East', -20.4439, 57.7100),
  ('mahebourg',       'Mahébourg',       'South-East', -20.4081, 57.7000),
  ('port-louis',      'Port Louis',      'Central', -20.1609, 57.5012)
on conflict (slug) do nothing;
