import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark" aria-hidden="true">O</div>
      <p className="eyebrow">404 · Page not found</p>
      <h1>This page isn’t here.</h1>
      <p className="not-found-copy">The link may be outdated, or the page may have moved. Let’s get you back to somewhere useful.</p>
      <div className="not-found-actions">
        <Link className="ui-button ui-button-primary" href="/app"><Home size={16} aria-hidden="true" /> Go to Ozlind</Link>
        <Link className="ui-button ui-button-secondary" href="/"><ArrowLeft size={16} aria-hidden="true" /> Go to home</Link>
      </div>
    </main>
  );
}