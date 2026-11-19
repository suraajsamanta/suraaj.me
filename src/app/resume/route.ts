import { resumeRoute } from "@/lib/resumes/vault";
import bigTech from "@/lib/resumes/big-tech";

const handlers = resumeRoute(bigTech);

export const GET = handlers.GET;
export const POST = handlers.POST;
