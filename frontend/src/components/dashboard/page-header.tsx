import { pageHeaderTitleClass, pageHeaderWrapperClass } from "@/lib/dashboard-ui";

interface PageHeaderProps {
  title: string;
  className?: string;
}

export function PageHeader({ title, className }: PageHeaderProps) {
  return (
    <div className={className ?? pageHeaderWrapperClass}>
      <h1 className={pageHeaderTitleClass}>{title}</h1>
    </div>
  );
}
