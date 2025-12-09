-- =====================================================
-- Speed Does America - Supabase Schema Migration
-- Run this entire file in Supabase SQL Editor
-- =====================================================

-- 1. Create client record for Speed
INSERT INTO clients (id, name, slug, "isActive", "createdAt", "updatedAt")
VALUES ('speed-does-america', 'Speed Does America', 'speed', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create speed_status table (from Firestore status/current)
CREATE TABLE IF NOT EXISTS speed_status (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION DEFAULT 0,
    lng DOUBLE PRECISION DEFAULT 0,
    state TEXT,
    quote TEXT,
    city TEXT,
    "cityPolygon" TEXT,
    "isSleep" BOOLEAN DEFAULT false,
    "isTraveling" BOOLEAN DEFAULT false,
    "lastUpdated" TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_client_status UNIQUE ("clientId")
);

-- 3. Create speed_cities table (from Firestore cities collection)
CREATE TABLE IF NOT EXISTS speed_cities (
    id TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    state TEXT,
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

-- 4. Create speed_posts table (from Firestore cities/{id}/posts subcollection)
CREATE TABLE IF NOT EXISTS speed_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "cityId" TEXT NOT NULL REFERENCES speed_cities(id) ON DELETE CASCADE,
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

-- 5. Create speed_merch table (from Firestore merch collection)
CREATE TABLE IF NOT EXISTS speed_merch (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    url TEXT,
    active BOOLEAN DEFAULT true,
    "shirtTexture" TEXT,
    "defaultAnimation" TEXT,
    "autoDisableAt" TIMESTAMPTZ,
    "shopifyVariantId" TEXT,
    "shopifyProductId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create speed_settings table (from Firestore settings/globals)
CREATE TABLE IF NOT EXISTS speed_settings (
    id TEXT PRIMARY KEY DEFAULT 'globals',
    "clientId" TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    "socialScrapeIntervalMin" INTEGER DEFAULT 5,
    "instagramUsername" TEXT DEFAULT '',
    "twitterUsername" TEXT DEFAULT '',
    "tiktokUsername" TEXT DEFAULT '',
    "twitchUsername" TEXT DEFAULT '',
    "youtubeUsername" TEXT DEFAULT '',
    "socialHashtag" TEXT DEFAULT 'SpeedDoesAmerica',
    "curatorApiBase" TEXT DEFAULT '',
    "curatorFeedId" TEXT DEFAULT '',
    "curatorJsonUrl" TEXT DEFAULT '',
    "disableMerch" BOOLEAN DEFAULT false,
    "sleepHideUserBar" BOOLEAN DEFAULT false,
    "departureTime" TEXT DEFAULT '22:00',
    "departureTimeUtc" INTEGER DEFAULT 1320,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_client_settings UNIQUE ("clientId")
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_speed_cities_client ON speed_cities("clientId");
CREATE INDEX IF NOT EXISTS idx_speed_cities_order ON speed_cities("clientId", "order");
CREATE INDEX IF NOT EXISTS idx_speed_posts_city ON speed_posts("cityId");
CREATE INDEX IF NOT EXISTS idx_speed_posts_timestamp ON speed_posts("clientId", "timestampDt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_speed_posts_dedup ON speed_posts("clientId", platform, "postId")
    WHERE platform IS NOT NULL AND "postId" IS NOT NULL;

-- 8. Enable Row Level Security on all tables
ALTER TABLE speed_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_merch ENABLE ROW LEVEL SECURITY;
ALTER TABLE speed_settings ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for public read access
CREATE POLICY "Public read" ON speed_status FOR SELECT USING (true);
CREATE POLICY "Public read" ON speed_cities FOR SELECT USING (true);
CREATE POLICY "Public read" ON speed_posts FOR SELECT USING (true);
CREATE POLICY "Public read" ON speed_merch FOR SELECT USING (true);
CREATE POLICY "Public read" ON speed_settings FOR SELECT USING (true);

-- 10. Create RLS policies for service role write access
CREATE POLICY "Service write" ON speed_status FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON speed_cities FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON speed_posts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON speed_merch FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write" ON speed_settings FOR ALL USING (auth.role() = 'service_role');

-- 11. Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('speed-media', 'speed-media', true)
ON CONFLICT (id) DO NOTHING;

-- 12. Create storage policies
CREATE POLICY "Public read speed-media" ON storage.objects
    FOR SELECT USING (bucket_id = 'speed-media');

CREATE POLICY "Service upload speed-media" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'speed-media' AND auth.role() = 'service_role');

CREATE POLICY "Service update speed-media" ON storage.objects
    FOR UPDATE USING (bucket_id = 'speed-media' AND auth.role() = 'service_role');

CREATE POLICY "Service delete speed-media" ON storage.objects
    FOR DELETE USING (bucket_id = 'speed-media' AND auth.role() = 'service_role');

-- =====================================================
-- Done! After running this:
-- 1. Create an admin user in Supabase Auth dashboard
-- 2. Update your .env files with Supabase credentials
-- 3. Run the migration script:
--    python -m backend.scripts.migrate_firestore_to_supabase
-- =====================================================
