import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { createShopApiV1ShopsPost } from "@/lib/api/generated/clients/createShopApiV1ShopsPost";
import { getErrorMessage } from "@/lib/api-client";
import { useSession } from "@/lib/session";

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function CreateShopDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { refreshUser } = useSession();

  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        toast.error("Couldn't get your location.");
        setLocating(false);
      },
    );
  };

  const create = useMutation({
    mutationFn: () =>
      createShopApiV1ShopsPost({
        body: {
          name: name.trim(),
          address_line_1: addressLine1.trim(),
          city: city.trim(),
          country: country.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          description: description.trim() || null,
          address_line_2: addressLine2.trim() || null,
          state: state.trim() || null,
          postal_code: postalCode.trim() || null,
          timezone: timezone.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      }),
    onSuccess: async ({ data }) => {
      toast.success(`${data.data.name} is live`);
      await refreshUser();
      onOpenChange(false);
      void navigate({
        to: "/manage/$shopId",
        params: { shopId: data.data.id },
      });
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !addressLine1.trim() ||
      !city.trim() ||
      !country.trim() ||
      !timezone.trim() ||
      !latitude.trim() ||
      !longitude.trim()
    ) {
      setError(
        "Name, address, city, country, timezone and location are required.",
      );
      return;
    }
    if (Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
      setError("Latitude and longitude must be numbers.");
      return;
    }
    setError(null);
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create your shop</DialogTitle>
          <DialogDescription>
            Goes live immediately — you can add barbers and services right
            after.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="shop-name">Shop name</Label>
            <Input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-phone">Phone</Label>
              <Input
                id="shop-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-email">Email</Label>
              <Input
                id="shop-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="shop-address">Address</Label>
            <Input
              id="shop-address"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-city">City</Label>
              <Input
                id="shop-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="shop-country">Country</Label>
              <Input
                id="shop-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="shop-timezone">Timezone</Label>
            <Input
              id="shop-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Location</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={useMyLocation}
                disabled={locating}
              >
                {locating ? "Locating…" : "Use my current location"}
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Input
                aria-label="Latitude"
                type="number"
                step="any"
                placeholder="Latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <Input
                aria-label="Longitude"
                type="number"
                step="any"
                placeholder="Longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="more-details" className="border-none">
              <AccordionTrigger className="py-2 text-sm">
                More details
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div>
                  <Label htmlFor="shop-description">Description</Label>
                  <Input
                    id="shop-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shop-address-2">Address line 2</Label>
                  <Input
                    id="shop-address-2"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="shop-state">State</Label>
                    <Input
                      id="shop-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shop-postal-code">Postal code</Label>
                    <Input
                      id="shop-postal-code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create shop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
