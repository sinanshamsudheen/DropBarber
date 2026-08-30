import { useQuery } from "@tanstack/react-query";
import { getAppointmentApiV1AppointmentsAppointmentIdGet } from "@/lib/api/generated/clients/getAppointmentApiV1AppointmentsAppointmentIdGet";
import { hydrateAppointment } from "./appointment-hydration";

/** A single appointment, hydrated with joined shop/barber/service/customer
 * data. Used by `/bookings/$appointmentId` and the shop-management
 * appointment detail screen. */
export function useAppointmentDetail(appointmentId: string) {
  return useQuery({
    queryKey: ["appointment-detail", appointmentId],
    queryFn: async () => {
      const { data } = await getAppointmentApiV1AppointmentsAppointmentIdGet({
        path: { appointment_id: appointmentId },
      });
      return hydrateAppointment(data.data);
    },
  });
}
