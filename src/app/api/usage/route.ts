import { apiError, apiOk } from "@/server/api";
import { getRequestContext } from "@/server/context";
import { BillingService } from "@/server/services/billing-service";

const billing = new BillingService();

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return apiOk(await billing.usageSummary(context));
  } catch (error) {
    return apiError(error);
  }
}
