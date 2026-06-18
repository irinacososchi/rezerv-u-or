import { createFileRoute, useParams } from "@tanstack/react-router";
import { RoomFormPage } from "@/components/owner/room-form-page";

export const Route = createFileRoute("/panou/sali/$id/edit")({
  component: EditRoomRoute,
});

function EditRoomRoute() {
  const { id } = useParams({ from: "/panou/sali/$id/edit" });
  return <RoomFormPage roomId={id} />;
}
