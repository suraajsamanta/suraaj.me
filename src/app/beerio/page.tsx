import { madfunMetadata } from '../madfun/shared/share-metadata';
import Beerio from "./Beerio";

export const metadata = { ...madfunMetadata('beerio'), robots: { index: false, follow: false } };

export default function BeerioPage() {
  return <Beerio />;
}
