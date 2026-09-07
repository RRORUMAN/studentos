import { permanentRedirect } from "next/navigation";

/** The marketplace became Student Exchange. Old links keep working. */
export default function MarketplaceRedirect() {
  permanentRedirect("/exchange");
}
