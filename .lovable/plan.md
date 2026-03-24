

## Plan: Deploy chat and optimize Edge Functions

Deploy these 2 functions to production as-is, no code changes:

1. **chat**
2. **optimize**

### Technical Notes
- Per the source-code-control memory directive, no code will be modified.
- Both functions will be deployed using `supabase--deploy_edge_functions` and verified with test invocations.
- The `GOOGLE_API_KEY` secret is already configured for these functions.

