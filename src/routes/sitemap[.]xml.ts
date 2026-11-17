import { createFileRoute } from "@tanstack/react-router";
import { isSitemapRouteIncluded, sitemapPathForLocation, sitemapStaticPaths, sitemapXML, type SitemapEntry } from "@/lib/sitemap";

const BASE_URL = "https://rzrv.ro/";
const ROOMS_URL = "https://ctvbcywmyigggwmozevr.supabase.co";
const ROOMS_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dmJjeXdteWlnZ2d3bW96ZXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODgyNDIsImV4cCI6MjA5Mjk2NDI0Mn0.ityBWV-a-N0sD_6GwUYyTx4SgQtVLfIu8cLaPt3wLbE";

export const Route = createFileRoute("/sitemap.xml")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => {
        const { getRouter } = await import("@/router");
        const router = getRouter();
        const entries: SitemapEntry[] = sitemapStaticPaths(router).map((path) => ({ path }));
        const routeId = "/sali/$slug";
        if (isSitemapRouteIncluded(router.routesById[routeId])) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(ROOMS_URL, ROOMS_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const pageSize = 1000;
          for (let offset = 0; ; ) {
            const { data, error } = await supabase
              .from("rooms")
              .select("id, slug")
              .eq("is_active", true)
              .order("id")
              .range(offset, offset + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            for (const row of data) {
              if (!row.slug) continue;
              const location = router.buildLocation({
                to: "/sali/$slug", params: { slug: row.slug }, search: () => ({}), hash: "",
              });
              const path = sitemapPathForLocation(router, location, routeId);
              if (path) entries.push({ path });
            }
            offset += data.length;
          }
        }
        return new Response(sitemapXML(BASE_URL, entries), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
