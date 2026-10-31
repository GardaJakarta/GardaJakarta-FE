import { useReportCatalog, defaultCategoryImage } from "../lib/use-report-categories";
import { evidenceUrl } from "../lib/api";

export default function CategoryImage({ category, src, className }: { category: string; src?: string | null; className?: string }) {
  const catalog = useReportCatalog();
  const custom = src || catalog?.find((item) => item.name === category)?.imageUrl;
  return <img src={custom ? evidenceUrl(custom) : defaultCategoryImage(category)} alt="" className={className} />;
}
