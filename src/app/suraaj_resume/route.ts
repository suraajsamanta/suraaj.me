import { resumeRoute } from "@/lib/resumes/vault";
import quant from "@/lib/resumes/quant";

const handlers = resumeRoute(quant);

export const GET = handlers.GET;
export const POST = handlers.POST;
