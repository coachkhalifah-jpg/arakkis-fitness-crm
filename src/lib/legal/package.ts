export type LegalPackageComponent = {
  id: string;
  type: string;
  version: number;
  text: string;
  effective_at: string;
};

export type LegalPackage = {
  id: string;
  version: string;
  effective_at: string;
  content_hash: string;
  components: LegalPackageComponent[];
};
