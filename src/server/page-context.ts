import { redirect } from "next/navigation";
import { getRequestContext, RequestContextError } from "@/server/context";

export async function getPageRequestContext() {
  try {
    return await getRequestContext();
  } catch (error) {
    if (error instanceof RequestContextError) {
      if (error.status === 401) {
        redirect("/sign-in");
      }

      if (error.status === 409) {
        redirect("/onboarding");
      }
    }

    throw error;
  }
}
