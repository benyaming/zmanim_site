import { Injectable } from '@angular/core';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  dateFormat = '';

  constructor() { }

  // getLocationsAutocomplete(query: string): Observable<any> {
  //   const url = 'https://autocomplete.search.hereapi.com/v1/autocomplete';
  //   const params = {
  //     q: query
  //   };
  //   const token = '';
  // }
}
