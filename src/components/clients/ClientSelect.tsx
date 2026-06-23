import { useEffect, useState } from "react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/external-client";
import { ClientFormDialog } from "./ClientFormDialog";
import { LinkedBadge } from "./LinkedBadge";

type ClientLite = {
  id: string;
  name: string;
  linked_user_id: string | null;
};

type Props = {
  context: "owner" | "renter";
  value: string | null;
  onChange: (clientId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function ClientSelect({
  context,
  value,
  onChange,
  disabled,
  placeholder = "Selectează un client...",
  className,
}: Props) {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialName, setInitialName] = useState("");

  async function fetchClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, linked_user_id")
      .eq("context", context)
      .eq("active", true)
      .order("name", { ascending: true });
    if (!error && data) setClients(data as ClientLite[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const selected = value ? clients.find((c) => c.id === value) ?? null : null;

  function openAddDialog(nameSeed: string) {
    setInitialName(nameSeed);
    setOpen(false);
    setDialogOpen(true);
  }

  async function handleAddSaved(newId?: string) {
    await fetchClients();
    if (newId) onChange(newId);
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={cn(
                "w-full justify-between font-normal",
                value ? "pr-9" : "",
                !selected && "text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {selected ? (
                  <>
                    <span className="truncate">{selected.name}</span>
                    {selected.linked_user_id && <LinkedBadge />}
                  </>
                ) : value && !loading ? (
                  <span className="truncate">...</span>
                ) : (
                  <span className="truncate">{placeholder}</span>
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Caută client..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {loading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Se încarcă...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>Niciun client cu acest nume.</CommandEmpty>
                    {clients.length > 0 && (
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              onChange(c.id);
                              setOpen(false);
                              setQuery("");
                            }}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="truncate">{c.name}</span>
                              {c.linked_user_id && <LinkedBadge />}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__add_new__"
                        onSelect={() => openAddDialog(query.trim())}
                        className="text-primary"
                      >
                        <Plus className="mr-1" />
                        {query.trim()
                          ? `Adaugă „${query.trim()}” ca client nou`
                          : "Adaugă client nou"}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Deselectează"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={context}
        client={null}
        initialName={initialName}
        onSaved={handleAddSaved}
      />
    </>
  );
}
