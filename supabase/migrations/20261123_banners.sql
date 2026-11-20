-- Banners da Home (separado de "Destaque") com ordem controlada pelo admin
ALTER TABLE movies ADD COLUMN IF NOT EXISTS in_banner boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS banner_order integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS in_banner boolean DEFAULT false;
ALTER TABLE series ADD COLUMN IF NOT EXISTS banner_order integer;

-- Quem já estava como destaque (is_featured) continua aparecendo no banner até você reorganizar
UPDATE movies SET in_banner = true, banner_order = COALESCE(featured_order, 99) WHERE is_featured = true AND in_banner IS NOT TRUE;
UPDATE series SET in_banner = true, banner_order = COALESCE(featured_order, 99) WHERE is_featured = true AND in_banner IS NOT TRUE;
