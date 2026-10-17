import { createCandidateHandler } from "../server/candidate-service.ts";
import { createBlobCandidateStore } from "../server/blob-store.ts";

const handleCandidates = createCandidateHandler(createBlobCandidateStore());

export default {
  fetch(request: Request) {
    return handleCandidates(request);
  },
};
