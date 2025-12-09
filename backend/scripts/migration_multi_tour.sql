-- =====================================================
-- Speed Does The World - Multi-Tour Migration
-- Run this after the initial supabase_schema.sql
-- =====================================================

-- 1. Create speed_tours table for tour metadata
CREATE TABLE IF NOT EXISTS speed_tours (
    id TEXT PRIMARY KEY,  -- 'america', 'africa', etc.
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,   -- 'Speed Does America', 'Speed Does Africa'
    slug TEXT NOT NULL,   -- 'america', 'africa'
    hashtag TEXT,         -- 'SpeedDoesAmerica', 'SpeedDoesAfrica'
    quote TEXT,           -- Default quote for tour
    "isActive" BOOLEAN DEFAULT false,  -- Is tour currently running
    "isComingSoon" BOOLEAN DEFAULT true,  -- Show "Coming Soon" overlay
    "centerLat" DOUBLE PRECISION DEFAULT 0,  -- Map center lat
    "centerLng" DOUBLE PRECISION DEFAULT 0,  -- Map center lng
    "defaultZoom" INTEGER DEFAULT 4,
    "colorTheme" TEXT DEFAULT 'america',  -- Theme identifier
    "logoUrl" TEXT,  -- Tour-specific logo
    "logoMobileUrl" TEXT,
    "displayOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tour_slug UNIQUE (slug)
);

-- 2. Add activeTourId to speed_status
ALTER TABLE speed_status ADD COLUMN IF NOT EXISTS "activeTourId" TEXT REFERENCES speed_tours(id);

-- 3. Add tourId to speed_settings for per-tour settings
ALTER TABLE speed_settings ADD COLUMN IF NOT EXISTS "tourId" TEXT REFERENCES speed_tours(id);

-- 4. Rename speed_cities to speed_cities_america
ALTER TABLE speed_cities RENAME TO speed_cities_america;

-- 5. Update indexes for renamed table
DROP INDEX IF EXISTS idx_speed_cities_client;
DROP INDEX IF EXISTS idx_speed_cities_order;
CREATE INDEX IF NOT EXISTS idx_speed_cities_america_client ON speed_cities_america("clientId");
CREATE INDEX IF NOT EXISTS idx_speed_cities_america_order ON speed_cities_america("clientId", "order");

-- 6. Update foreign key in speed_posts to reference speed_cities_america
-- Note: This requires dropping and recreating the constraint
ALTER TABLE speed_posts DROP CONSTRAINT IF EXISTS speed_posts_cityId_fkey;
ALTER TABLE speed_posts ADD CONSTRAINT speed_posts_cityId_fkey
    FOREIGN KEY ("cityId") REFERENCES speed_cities_america(id) ON DELETE CASCADE;

-- 7. Create speed_cities_africa table (same schema as america)
CREATE TABLE IF NOT EXISTS speed_cities_africa (
    id TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    state TEXT,  -- Can represent country/region for Africa
    lat DOUBLE PRECISION DEFAULT 0,
    lng DOUBLE PRECISION DEFAULT 0,
    "order" INTEGER DEFAULT 0,
    "isCurrent" BOOLEAN DEFAULT false,
    "lastCurrentAt" TIMESTAMPTZ,
    keywords TEXT,
    "locatorIconUrl" TEXT,
    "locatorPng" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create posts table for Africa tour
CREATE TABLE IF NOT EXISTS speed_posts_africa (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "cityId" TEXT NOT NULL REFERENCES speed_cities_africa(id) ON DELETE CASCADE,
    platform TEXT,
    "postId" TEXT,
    username TEXT,
    caption TEXT,
    "mediaUrl" TEXT,
    "imageUrl" TEXT,
    "avatarUrl" TEXT,
    "likeCount" INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ,
    "timestampDt" TIMESTAMPTZ,
    url TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create indexes for Africa tables
CREATE INDEX IF NOT EXISTS idx_speed_cities_africa_client ON speed_cities_africa("clientId");
CREATE INDEX IF NOT EXISTS idx_speed_cities_africa_order ON speed_cities_africa("clientId", "order");
CREATE INDEX IF NOT EXISTS idx_speed_posts_africa_city ON speed_posts_africa("cityId");
CREATE INDEX IF NOT EXISTS idx_speed_posts_africa_timestamp ON speed_posts_africa("clientId", "timestampDt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_speed_posts_africa_dedup ON speed_posts_africa("clientId", platform, "postId")
    WHERE platform IS NOT NULL AND "postId" IS NOT NULL;

-- 10. Enable RLS on new tables
ALTER TABLE speed_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_cities_africa ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_posts_africa ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for new tables
CREATE POLICY "Public read" ON speed_tours FOR SELECT USING (true);
CREATE POLICY "Service write" ON speed_tours FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read" ON speed_cities_africa FOR SELECT USING (true);
CREATE POLICY "Service write" ON speed_cities_africa FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public read" ON speed_posts_africa FOR SELECT USING (true);
CREATE POLICY "Service write" ON speed_posts_africa FOR ALL USING (auth.role() = 'service_role');

-- 12. Seed tour data
INSERT INTO speed_tours (id, "clientId", name, slug, hashtag, quote, "isActive", "isComingSoon", "centerLat", "centerLng", "defaultZoom", "colorTheme", "displayOrder")
VALUES
    ('america', 'speed-does-america', 'Speed Does America', 'america', 'SpeedDoesAmerica', 'Coast to coast!', true, false, 39.8283, -98.5795, 4, 'america', 1),
    ('africa', 'speed-does-america', 'Speed Does Africa', 'africa', 'SpeedDoesAfrica', 'The adventure continues...', false, true, 0, 20, 3, 'africa', 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    hashtag = EXCLUDED.hashtag,
    quote = EXCLUDED.quote,
    "isActive" = EXCLUDED."isActive",
    "isComingSoon" = EXCLUDED."isComingSoon",
    "centerLat" = EXCLUDED."centerLat",
    "centerLng" = EXCLUDED."centerLng",
    "defaultZoom" = EXCLUDED."defaultZoom",
    "colorTheme" = EXCLUDED."colorTheme",
    "displayOrder" = EXCLUDED."displayOrder",
    "updatedAt" = NOW();

-- 13. Set default active tour in status
UPDATE speed_status SET "activeTourId" = 'america' WHERE "activeTourId" IS NULL;

-- 14. Add endDate column to speed_tours for tour end tracking
ALTER TABLE speed_tours ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMPTZ;

-- =====================================================
-- Migration complete!
-- Next steps:
-- 1. Update backend/supabase_repo.py with tour functions
-- 2. Update backend/main.py with tour endpoints
-- 3. Update frontend to support multi-tour
-- =====================================================
