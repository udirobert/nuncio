import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/lib/navigation";

/**
 * /playbook used to hold the public worked examples — the same word the
 * product uses for *your* representative's playbook. The examples moved to
 * /examples so the two can never be confused; this redirect keeps old links
 * and bookmarks working.
 */
export default function LegacyPlaybookPage() {
  redirect(APP_ROUTES.examples);
}
