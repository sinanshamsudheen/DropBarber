import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { ManageHeader, RequirePermission } from "@/components/layout/manage-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listServices, saveService } from "@/lib/api";
import { money } from "@/lib/format";
import type { Service } from "@/lib/types";

export const Route = createFileRoute("/manage/$shopId/services")({
  component: ServicesRoute,
});

function ServicesRoute() {
  const { shopId } = Route.useParams();
  return (
    <RequirePermission shopId={shopId} permission="services:manage">
      <ServicesPage />
    </RequirePermission>
  );
}

function ServicesPage() {
  const { shopId } = Route.useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Service | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const q = useQuery({
    queryKey: ["services", shopId],
    queryFn: () => listServices(shopId),
  });

  const toggle = useMutation({
    mutationFn: (service: Service) =>
      saveService(shopId, { id: service.id, active: !service.active }),
    onSuccess: (service) => {
      toast.success(
        `${service.name} ${service.active ? "is bookable again" : "is no longer bookable"}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["services", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditing(service);
    setDialogOpen(true);
  };

  return (
    <div>
      <ManageHeader
        title="Services"
        description="Your menu. Each barber sets their own duration for these."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        }
      />

      <ServiceFormDialog
        shopId={shopId}
        service={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {q.isPending && <ListSkeleton rows={4} />}
      {q.isError && (
        <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
      )}
      {q.isSuccess && q.data.length === 0 && (
        <EmptyState
          icon={Store}
          title="No services yet"
          description="Add the cuts and grooms you offer so customers have something to book."
          action={<Button onClick={openNew}>Add a service</Button>}
        />
      )}

      <ul className="space-y-2">
        {q.data?.map((service) => (
          <li key={service.id} className="rounded-md border border-hairline bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{service.name}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {service.description}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">{money(service.price)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  id={`service-active-${service.id}`}
                  checked={service.active}
                  disabled={toggle.isPending}
                  onCheckedChange={() => toggle.mutate(service)}
                />
                <label
                  htmlFor={`service-active-${service.id}`}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {service.active ? "Bookable" : "Hidden from customers"}
                </label>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEdit(service)}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceFormDialog({
  shopId,
  service,
  open,
  onOpenChange,
}: {
  shopId: string;
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setPrice(service ? String(service.price) : "");
    setError(null);
  }, [open, service]);

  const save = useMutation({
    mutationFn: () =>
      saveService(shopId, {
        ...(service ? { id: service.id } : {}),
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
      }),
    onSuccess: () => {
      toast.success(service ? "Service updated" : "Service added");
      void queryClient.invalidateQueries({ queryKey: ["services", shopId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the service a name customers will recognise.");
      return;
    }
    setError(null);
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? `Edit ${service.name}` : "Add a service"}</DialogTitle>
          <DialogDescription>
            Set the shop price here. Individual barbers can take longer or charge differently.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="service-name">Name</Label>
            <Input
              id="service-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Haircut + beard"
              className="mt-2"
              aria-invalid={!!error}
              aria-describedby={error ? "service-name-error" : undefined}
            />
            {error && (
              <p id="service-name-error" role="alert" className="mt-1.5 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="service-description">Description</Label>
            <Textarea
              id="service-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the customer gets."
              className="mt-1.5 min-h-20"
            />
          </div>
          <div>
            <Label htmlFor="service-price">Price (₹)</Label>
            <Input
              id="service-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
              className="mt-2"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : service ? "Save changes" : "Add service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
