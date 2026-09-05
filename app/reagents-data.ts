// The private laboratory inventory is stored in the server-side D1 database.
// This intentionally empty seed keeps internal reagent records out of GitHub.
export type SeedReagent = {
  name: string;
  alias: string;
  cas: string;
  location: string;
  storageTemp: string;
  stock: number;
  unit: string;
  threshold: number;
  status: string;
  supplier: string;
  updated: string;
  expiry: string;
  notes: string;
};

export const fridgeReagents: SeedReagent[] = [];
