import { ProdutosContent, metadata } from "./ProdutosContent";

export { metadata };

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ pais?: string }> }) {
  const { pais } = await searchParams;
  return <ProdutosContent paisExplicito={pais} />;
}
