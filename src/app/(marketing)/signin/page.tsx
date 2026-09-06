import { permanentRedirect } from "next/navigation";

/**
 * `/signin` was the pre-product placeholder that explained accounts were not
 * open yet. They are now, so it permanently redirects to the real screen rather
 * than being deleted — the path is in the wild, in old links and bookmarks.
 */
export default function SignInRedirect(): never {
  permanentRedirect("/login");
}
