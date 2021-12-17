// NOTE: It is important to use here type assertion and not interface,
// because HttpClient of angular will treat it differently.
// See https://stackoverflow.com/questions/60697214/how-to-fix-index-signature-is-missing-in-type-error
export type ZmanimQueryParams = {
  date: string;
  lat: string;
  lng: string;
};
