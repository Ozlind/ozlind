import Link from "next/link";

export const metadata = {
  title: "Page not found — OZLIND AI",
};

export default function NotFound() {
  return (
    <main role="main" className="ozlind-error-page">
      <section className="ozlind-error-card">
        <div className="ozlind-error-mark" aria-hidden="true">
          404
        </div>

        <h1>Page not found</h1>

        <p>
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="ozlind-error-actions">
          <Link href="/" className="ozlind-error-primary">
            Back to OZLIND
          </Link>
        </div>
      </section>
    </main>
  );
}