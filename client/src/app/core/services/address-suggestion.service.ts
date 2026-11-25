import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

/** An address to fill the address form with: `AddressController.Suggest` on the server. */
export interface AddressSuggestion {
  /** House number and street, or the street alone when the number isn't known. */
  address1: string;
  city?: string;
  /** The state's id among the cached states, when it is one of them. */
  stateId?: string;
  stateShortName?: string;
  zipcode?: string;
  /** The whole address on one line, for the list. */
  label: string;
}

export interface AddressSuggestions {
  /** The credit the data's licence asks for, to show with the suggestions. */
  attribution: string;
  suggestions: AddressSuggestion[];
}

/**
 * U.S. addresses that start with what the user has typed, for the address form's first line.
 *
 * The server asks Photon, a geocoder over OpenStreetMap data, so the client needs no key and knows
 * nothing of the provider (see the server README's "Address completion").  A suggestion is a
 * convenience: when the request fails, there are none, and the user goes on typing.
 */
@Injectable({ providedIn: 'root' })
export class AddressSuggestionService {
  private readonly http = inject(HttpClient);

  async suggest(text: string): Promise<AddressSuggestions> {
    try {
      return await firstValueFrom(
        this.http.get<AddressSuggestions>(`${environment.addressApiRoot}/Suggest`, { params: { q: text } }),
      );
    } catch {
      return { attribution: '', suggestions: [] };
    }
  }
}
