import { redirect } from "next/navigation";

/** Legacy route — use /pos/login */
export default function LegacyPosLoginRedirect() {
  redirect("/pos/login");
}
