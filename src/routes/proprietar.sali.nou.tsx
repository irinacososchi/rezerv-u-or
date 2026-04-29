import { createFileRoute } from "@tanstack/react-router";
import { RoomFormPage } from "@/components/owner/room-form-page";

export const Route = createFileRoute("/proprietar/sali/nou")({
  component: () => <RoomFormPage />,
});
