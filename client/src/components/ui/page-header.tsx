import React from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backLink?: string;
  backText?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  backLink,
  backText = "Назад",
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {backLink && (
        <Link href={backLink} className="flex items-center text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="mr-1 h-4 w-4" />
          <span className="text-sm">{backText}</span>
        </Link>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </div>
  );
}