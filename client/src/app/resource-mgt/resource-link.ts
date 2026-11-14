/**
 * The in-app URL that opens a staffing resource in Resource Management.
 *
 * `ResourceMgtComponent` receives the id as its `resource` input (the router binds query parameters
 * to inputs), opens that person and searches for them.  Quinn links the people it mentions here.
 * This is the only place outside the route table that knows the URL.
 */
export function resourceLink(id: string): string {
  return `/resourcemgt?resource=${encodeURIComponent(id)}`;
}
