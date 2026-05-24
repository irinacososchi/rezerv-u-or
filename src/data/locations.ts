import { supabase } from "@/integrations/supabase/external-client";

export type County = { id: number; name: string; code: string };
export type City = {
  id: number;
  county_id: number;
  name: string;
  is_sector: boolean;
};

/** All counties, sorted alphabetically, with "București" pinned first. */
export async function fetchCounties(): Promise<County[]> {
  const { data, error } = await supabase
    .from("counties")
    .select("id, name, code")
    .order("name", { ascending: true });
  if (error) {
    console.error("fetchCounties:", error.message);
    return [];
  }
  const rows = (data ?? []) as County[];
  const buc = rows.find((c) => c.name === "București");
  const rest = rows.filter((c) => c.name !== "București");
  return buc ? [buc, ...rest] : rows;
}

/** Cities in a county, sorted alphabetically. */
export async function fetchCitiesByCounty(countyId: number): Promise<City[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, county_id, name, is_sector")
    .eq("county_id", countyId)
    .order("name", { ascending: true });
  if (error) {
    console.error("fetchCitiesByCounty:", error.message);
    return [];
  }
  return (data ?? []) as City[];
}

/** Lookup a single city (used to pre-populate edit form from city_id). */
export async function fetchCity(cityId: number): Promise<City | null> {
  const { data, error } = await supabase
    .from("cities")
    .select("id, county_id, name, is_sector")
    .eq("id", cityId)
    .maybeSingle();
  if (error) {
    console.error("fetchCity:", error.message);
    return null;
  }
  return (data as City | null) ?? null;
}
