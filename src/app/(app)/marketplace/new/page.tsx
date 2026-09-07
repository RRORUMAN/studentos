import { permanentRedirect } from "next/navigation";

export default function NewListingRedirect() {
  permanentRedirect("/exchange/new");
}
