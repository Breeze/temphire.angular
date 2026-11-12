/**
 * Read-only row in the search grid.
 *
 * Ported from `DomainModel/Projections/StaffingResourceListItem.cs`.  It is *not* a Breeze entity -
 * the server returns it as a plain DTO from `BreezeController.StaffingResourceListItems` - which
 * matches the original, where the projection implemented DevForce's `IKnownType` rather than being
 * a mapped entity.
 */
export interface StaffingResourceListItem {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  areaCode?: string;
  number?: string;
  phoneNumber?: string;
}
