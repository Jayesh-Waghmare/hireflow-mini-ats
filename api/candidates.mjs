import { forwardCandidates } from '../lib/vercel-proxy.mjs';

export default {
  fetch(request) {
    return forwardCandidates(request);
  },
};
