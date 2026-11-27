import { ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { docsForPath } from "@/lib/docs";

/** A "Docs" button pointing at the documentation for the page that is open, when it has one. */
export function PageDocsLink() {
  const { pathname } = useLocation();
  const href = docsForPath(pathname);
  if (!href) return null;
  return (
    <Button variant="outline" asChild>
      <a href={href} target="_blank" rel="noreferrer" aria-label="Documentation for this page (opens in a new tab)">
        <ExternalLink className="mr-1.5 size-3.5" />
        Docs
      </a>
    </Button>
  );
}
