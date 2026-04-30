import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner-layout";
import { supabase } from "@/integrations/supabase/external-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { DAY_NAMES_RO } from "@/lib/date-utils";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type ScheduleRow = {
  day_of_week: number;
  is_available: boolean;
  open_time: string;
  close_time: string;
};

type PricingRule = {
  // local id used only for React keys
  _key: string;
  // server id, undefined for new rules
  id?: string;
  label: string;
  price_per_hour: number;
  days_of_week: number[];
  has_time_window: boolean;
  start_time: string | null;
  end_time: string | null;
  priority: number;
  is_active: boolean;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  neighbourhood: string;
  google_maps_url: string;
  currency: string;
  floor_size_sqm: string;
  has_mirrors: boolean;
  has_sound_system: boolean;
  has_ballet_barre: boolean;
  has_changing_room: boolean;
  has_air_conditioning: boolean;
  extra_equipment: string;
  booking_type: "instant" | "manual";
  advance_booking_days: string;
  min_booking_hours: string;
  free_cancellation_hours: string;
  rules_and_notes: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  address: "",
  city: "",
  neighbourhood: "",
  google_maps_url: "",
  currency: "RON",
  floor_size_sqm: "",
  has_mirrors: false,
  has_sound_system: false,
  has_ballet_barre: false,
  has_changing_room: false,
  has_air_conditioning: false,
  extra_equipment: "",
  booking_type: "instant",
  advance_booking_days: "30",
  min_booking_hours: "1",
  free_cancellation_hours: "24",
  rules_and_notes: "",
  is_active: true,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

function defaultSchedule(): ScheduleRow[] {
  return DAYS.map((d) => ({
    day_of_week: d,
    is_available: d <= 5,
    open_time: "09:00",
    close_time: "21:00",
  }));
}

function toHHMM(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function RoomFormPage({ roomId }: { roomId?: string }) {
  const navigate = useNavigate();
  const isEdit = !!roomId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(defaultSchedule());
  const [pricing, setPricing] = useState<PricingRule[]>([]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    async function load() {
      const { data: room, error } = await supabase
        .from("rooms")
        .select(`*, weekly_schedule(*), pricing_rules(*)`)
        .eq("id", roomId!)
        .single();
      if (cancelled) return;
      if (error || !room) {
        toast.error("Sala nu a fost găsită.");
        setLoading(false);
        return;
      }
      const r = room as Record<string, unknown> & {
        weekly_schedule?: Array<Record<string, unknown>>;
        pricing_rules?: Array<Record<string, unknown>>;
      };
      setForm({
        name: (r.name as string) ?? "",
        slug: (r.slug as string) ?? "",
        description: (r.description as string) ?? "",
        address: (r.address as string) ?? "",
        city: (r.city as string) ?? "",
        neighbourhood: (r.neighbourhood as string) ?? "",
        google_maps_url: (r.google_maps_url as string) ?? "",
        currency: (r.currency as string) ?? "RON",
        floor_size_sqm:
          r.floor_size_sqm != null ? String(r.floor_size_sqm) : "",
        has_mirrors: !!r.has_mirrors,
        has_sound_system: !!r.has_sound_system,
        has_ballet_barre: !!r.has_ballet_barre,
        has_changing_room: !!r.has_changing_room,
        has_air_conditioning: !!r.has_air_conditioning,
        extra_equipment: (r.extra_equipment as string) ?? "",
        booking_type:
          (r.booking_type as "instant" | "manual") === "manual"
            ? "manual"
            : "instant",
        advance_booking_days:
          r.advance_booking_days != null
            ? String(r.advance_booking_days)
            : "30",
        min_booking_hours:
          r.min_booking_hours != null ? String(r.min_booking_hours) : "1",
        free_cancellation_hours:
          r.free_cancellation_hours != null
            ? String(r.free_cancellation_hours)
            : "24",
        rules_and_notes: (r.rules_and_notes as string) ?? "",
        is_active: r.is_active !== false,
      });

      const sched = (r.weekly_schedule ?? []) as Array<{
        day_of_week: number;
        is_available: boolean;
        open_time: string;
        close_time: string;
      }>;
      const byDay = new Map(sched.map((s) => [s.day_of_week, s]));
      setSchedule(
        DAYS.map((d) => {
          const s = byDay.get(d);
          return {
            day_of_week: d,
            is_available: s?.is_available ?? false,
            open_time: toHHMM(s?.open_time) || "09:00",
            close_time: toHHMM(s?.close_time) || "21:00",
          };
        }),
      );

      const rules = (r.pricing_rules ?? []) as Array<{
        id: string;
        label: string | null;
        price_per_hour: number;
        days_of_week: number[] | null;
        start_time: string | null;
        end_time: string | null;
        priority: number | null;
        is_active: boolean | null;
      }>;
      setPricing(
        rules.map((rule) => ({
          _key: rule.id,
          id: rule.id,
          label: rule.label ?? "",
          price_per_hour: Number(rule.price_per_hour),
          days_of_week: rule.days_of_week ?? [],
          has_time_window: !!(rule.start_time && rule.end_time),
          start_time: toHHMM(rule.start_time) || null,
          end_time: toHHMM(rule.end_time) || null,
          priority: rule.priority ?? 0,
          is_active: rule.is_active !== false,
        })),
      );

      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, roomId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleNameChange(value: string) {
    update("name", value);
    if (!slugTouched) {
      setForm((f) => ({ ...f, name: value, slug: slugify(value) }));
    }
  }

  function addPricingRule() {
    setPricing((p) => [
      ...p,
      {
        _key: newKey(),
        label: "",
        price_per_hour: 0,
        days_of_week: [1, 2, 3, 4, 5],
        has_time_window: false,
        start_time: null,
        end_time: null,
        priority: 0,
        is_active: true,
      },
    ]);
  }

  function updatePricing(key: string, patch: Partial<PricingRule>) {
    setPricing((p) => p.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function removePricing(key: string) {
    setPricing((p) => p.filter((r) => r._key !== key));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Numele sălii este obligatoriu.");
      return;
    }
    if (!form.address.trim() || !form.city.trim()) {
      toast.error("Adresa și orașul sunt obligatorii.");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Slug-ul este obligatoriu.");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      toast.error("Nu ești autentificat.");
      return;
    }

    const roomFields: Record<string, unknown> = {
      owner_id: user.id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description || null,
      address: form.address.trim(),
      city: form.city.trim(),
      neighbourhood: form.neighbourhood || null,
      google_maps_url: form.google_maps_url || null,
      currency: form.currency,
      floor_size_sqm: form.floor_size_sqm
        ? Number(form.floor_size_sqm)
        : null,
      has_mirrors: form.has_mirrors,
      has_sound_system: form.has_sound_system,
      has_ballet_barre: form.has_ballet_barre,
      has_changing_room: form.has_changing_room,
      has_air_conditioning: form.has_air_conditioning,
      extra_equipment: form.extra_equipment || null,
      booking_type: form.booking_type,
      advance_booking_days: Number(form.advance_booking_days) || 30,
      min_booking_hours: Number(form.min_booking_hours) || 1,
      free_cancellation_hours: Number(form.free_cancellation_hours) || 24,
      rules_and_notes: form.rules_and_notes || null,
      is_active: form.is_active,
    };
    if (isEdit) roomFields.id = roomId;

    const { data: savedRoom, error: roomErr } = await supabase
      .from("rooms")
      .upsert(roomFields)
      .select()
      .single();

    if (roomErr || !savedRoom) {
      console.error(roomErr);
      toast.error("Nu am putut salva sala.");
      setSaving(false);
      return;
    }

    const savedId = (savedRoom as { id: string }).id;

    // Weekly schedule: delete + insert
    await supabase.from("weekly_schedule").delete().eq("room_id", savedId);
    const scheduleRows = schedule.map((s) => ({
      room_id: savedId,
      day_of_week: s.day_of_week,
      is_available: s.is_available,
      open_time: s.is_available ? `${s.open_time}:00` : "00:00:00",
      close_time: s.is_available ? `${s.close_time}:00` : "00:00:00",
    }));
    const { error: schedErr } = await supabase
      .from("weekly_schedule")
      .insert(scheduleRows);
    if (schedErr) console.error(schedErr);

    // Pricing rules: delete + insert
    await supabase.from("pricing_rules").delete().eq("room_id", savedId);
    if (pricing.length > 0) {
      const pricingRows = pricing.map((r) => ({
        room_id: savedId,
        label: r.label || null,
        price_per_hour: Number(r.price_per_hour) || 0,
        days_of_week: r.days_of_week,
        start_time: r.has_time_window && r.start_time ? `${r.start_time}:00` : null,
        end_time: r.has_time_window && r.end_time ? `${r.end_time}:00` : null,
        priority: Number(r.priority) || 0,
        is_active: r.is_active,
      }));
      const { error: priceErr } = await supabase
        .from("pricing_rules")
        .insert(pricingRows);
      if (priceErr) console.error(priceErr);
    }

    setSaving(false);
    toast.success(isEdit ? "Sala a fost actualizată." : "Sala a fost creată.");
    navigate({ to: "/proprietar/sali" });
  }

  if (loading) {
    return (
      <OwnerLayout>
        <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="pb-32">
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <button
                type="button"
                onClick={() => navigate({ to: "/proprietar/sali" })}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Înapoi la săli
              </button>
              <h1 className="text-2xl md:text-3xl font-semibold mt-2">
                {isEdit ? "Editează sala" : "Adaugă sală nouă"}
              </h1>
            </div>
          </div>

          {/* Section 1 — General */}
          <Card>
            <CardHeader>
              <CardTitle>Informații generale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nume sală *">
                <Input
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  maxLength={120}
                />
              </Field>
              <Field label="Slug (URL) *">
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", slugify(e.target.value));
                  }}
                  maxLength={80}
                />
              </Field>
              <Field label="Descriere">
                <Textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  rows={4}
                  maxLength={2000}
                />
              </Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Adresă *">
                  <Input
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    maxLength={200}
                  />
                </Field>
                <Field label="Oraș *">
                  <Input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    maxLength={100}
                  />
                </Field>
                <Field label="Cartier">
                  <Input
                    value={form.neighbourhood}
                    onChange={(e) => update("neighbourhood", e.target.value)}
                    maxLength={100}
                  />
                </Field>
                <Field label="URL Google Maps">
                  <Input
                    value={form.google_maps_url}
                    onChange={(e) => update("google_maps_url", e.target.value)}
                    placeholder="https://maps.google.com/…"
                  />
                </Field>
                <Field label="Moneda">
                  <Select
                    value={form.currency}
                    onValueChange={(v) => update("currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RON">RON</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Section 2 — Amenities */}
          <Card>
            <CardHeader>
              <CardTitle>Dotări</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Suprafață (mp)">
                <Input
                  type="number"
                  min="0"
                  value={form.floor_size_sqm}
                  onChange={(e) => update("floor_size_sqm", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: "has_mirrors", label: "Oglinzi" },
                  { key: "has_sound_system", label: "Sistem audio" },
                  { key: "has_ballet_barre", label: "Bară balet" },
                  { key: "has_changing_room", label: "Vestiar" },
                  { key: "has_air_conditioning", label: "Aer condiționat" },
                ].map((a) => (
                  <label key={a.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form[a.key as keyof FormState] as boolean}
                      onCheckedChange={(v) =>
                        update(a.key as keyof FormState, !!v as never)
                      }
                    />
                    <span className="text-sm">{a.label}</span>
                  </label>
                ))}
              </div>
              <Field label="Echipament extra">
                <Textarea
                  value={form.extra_equipment}
                  onChange={(e) => update("extra_equipment", e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </Field>
            </CardContent>
          </Card>

          {/* Section 3 — Booking settings */}
          <Card>
            <CardHeader>
              <CardTitle>Setări rezervare</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Tip rezervare">
                <div className="flex gap-3">
                  {(["instant", "manual"] as const).map((t) => (
                    <label
                      key={t}
                      className={
                        "flex-1 cursor-pointer rounded-md border p-3 text-sm " +
                        (form.booking_type === t
                          ? "border-primary bg-primary/5"
                          : "border-border")
                      }
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={form.booking_type === t}
                        onChange={() => update("booking_type", t)}
                      />
                      <p className="font-medium capitalize">{t === "instant" ? "Instant" : "Manual"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t === "instant"
                          ? "Rezervările se confirmă automat."
                          : "Aprobi manual fiecare cerere."}
                      </p>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Zile rezervare în avans">
                  <Input
                    type="number"
                    min="1"
                    value={form.advance_booking_days}
                    onChange={(e) => update("advance_booking_days", e.target.value)}
                  />
                </Field>
                <Field label="Ore minime rezervare">
                  <Input
                    type="number"
                    min="1"
                    step="0.5"
                    value={form.min_booking_hours}
                    onChange={(e) => update("min_booking_hours", e.target.value)}
                  />
                </Field>
                <Field label="Ore anulare gratuită">
                  <Input
                    type="number"
                    min="0"
                    value={form.free_cancellation_hours}
                    onChange={(e) => update("free_cancellation_hours", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Reguli și note">
                <Textarea
                  value={form.rules_and_notes}
                  onChange={(e) => update("rules_and_notes", e.target.value)}
                  rows={4}
                  maxLength={2000}
                />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => update("is_active", !!v)}
                />
                <span className="text-sm">Sală activă (vizibilă pentru rezervare)</span>
              </label>
            </CardContent>
          </Card>

          {/* Section 4 — Weekly schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Program săptămânal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {schedule.map((row, idx) => (
                <div
                  key={row.day_of_week}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                >
                  <Switch
                    checked={row.is_available}
                    onCheckedChange={(v) => {
                      const next = [...schedule];
                      next[idx] = { ...row, is_available: !!v };
                      setSchedule(next);
                    }}
                  />
                  <span className="w-24 text-sm font-medium">
                    {DAY_NAMES_RO[row.day_of_week]}
                  </span>
                  {row.is_available ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={row.open_time}
                        onChange={(e) => {
                          const next = [...schedule];
                          next[idx] = { ...row, open_time: e.target.value };
                          setSchedule(next);
                        }}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={row.close_time}
                        onChange={(e) => {
                          const next = [...schedule];
                          next[idx] = { ...row, close_time: e.target.value };
                          setSchedule(next);
                        }}
                        className="w-32"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Indisponibil</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 5 — Pricing rules */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Preț</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Introduceți tarifele (ex: Tarif de weekend/seara/zi).
                </p>
              </div>
              <Button type="button" size="sm" onClick={addPricingRule}>
                <Plus className="h-4 w-4" /> Adaugă regulă
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricing.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nu ai reguli de preț. Adaugă cel puțin una pentru a putea primi rezervări.
                </p>
              ) : (
                pricing.map((rule) => (
                  <div
                    key={rule._key}
                    className="rounded-lg border p-4 space-y-3 bg-muted/20"
                  >
                    <div className="grid md:grid-cols-2 gap-3">
                      <Field label="Tip Tarif">
                        <Input
                          value={rule.label}
                          onChange={(e) =>
                            updatePricing(rule._key, { label: e.target.value })
                          }
                          maxLength={60}
                        />
                      </Field>
                      <Field label={`Preț/oră (${form.currency})`}>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rule.price_per_hour}
                          onChange={(e) =>
                            updatePricing(rule._key, {
                              price_per_hour: Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Prioritate">
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) =>
                            updatePricing(rule._key, {
                              priority: Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Zile săptămână">
                      <div className="flex gap-2 flex-wrap">
                        {DAYS.map((d) => {
                          const checked = rule.days_of_week.includes(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                const next = checked
                                  ? rule.days_of_week.filter((x) => x !== d)
                                  : [...rule.days_of_week, d].sort();
                                updatePricing(rule._key, { days_of_week: next });
                              }}
                              className={
                                "h-9 w-9 rounded-md border text-sm font-medium transition-colors " +
                                (checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-muted")
                              }
                            >
                              {DAY_NAMES_RO[d][0]}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={rule.has_time_window}
                        onCheckedChange={(v) =>
                          updatePricing(rule._key, {
                            has_time_window: !!v,
                            start_time: v ? rule.start_time ?? "18:00" : null,
                            end_time: v ? rule.end_time ?? "22:00" : null,
                          })
                        }
                      />
                      <span className="text-sm">Interval orar specific</span>
                    </label>
                    {rule.has_time_window && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={rule.start_time ?? ""}
                          onChange={(e) =>
                            updatePricing(rule._key, { start_time: e.target.value })
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={rule.end_time ?? ""}
                          onChange={(e) =>
                            updatePricing(rule._key, { end_time: e.target.value })
                          }
                          className="w-32"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(v) =>
                            updatePricing(rule._key, { is_active: !!v })
                          }
                        />
                        <span className="text-sm">Activă</span>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePricing(rule._key)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Șterge regulă
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sticky save bar */}
        <div className="fixed bottom-0 inset-x-0 md:left-64 bg-card/95 backdrop-blur border-t z-20">
          <div className="max-w-4xl mx-auto p-4 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/proprietar/sali" })}
              disabled={saving}
            >
              Anulează
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Se salvează..." : "Salvează sala"}
            </Button>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
