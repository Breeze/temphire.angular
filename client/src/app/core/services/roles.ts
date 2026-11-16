/**
 * The roles a user can have; the server's `TempHireRoles`.
 *
 * - **Editor**: sees the company's staffing resources and changes them.
 * - **Reader**: sees them, and changes nothing.
 *
 * The client uses them only to decide what to show.  The server enforces them: it refuses the
 * staffing data to users with neither role, and saves to anyone but an editor.
 */
export const Roles = {
  Editor: 'Editor',
  Reader: 'Reader',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];
