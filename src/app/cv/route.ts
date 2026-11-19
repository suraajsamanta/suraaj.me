import { resumeRoute } from "@/lib/resumes/vault";
import aiLabs from "@/lib/resumes/ai-labs";

const handlers = resumeRoute(aiLabs);

export const GET = handlers.GET;
export const POST = handlers.POST;
