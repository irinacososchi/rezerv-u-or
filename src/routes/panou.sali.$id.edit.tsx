import { createFileRoute, useParams } from "@tanstack/react-router";
import { RoomFormPage } from "@/components/owner/room-form-page";

export const Route = createFileRoute("/proprietar/sali/$id/edit")({
  component: EditRoomRoute,
});

function EditRoomRoute() {
  const { id } = useParams({ from: "/proprietar/sali/$id/edit" });
  return <RoomFormPage roomId={id} />;
}
