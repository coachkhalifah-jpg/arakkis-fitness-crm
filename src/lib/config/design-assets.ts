import { getPublicEnv } from "@/lib/config/env";

export function designAssetPublicUrl(path: string) {
  const env = getPublicEnv();
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/design-assets/${path}`;
}
