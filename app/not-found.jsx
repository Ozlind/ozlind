import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, background: '#090a0d', color: '#f4f6f8', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <section style={{ width: 'min(520px,100%)', padding: 28, border: '1px solid #242932', borderRadius: 20, background: '#0f1115' }}>
        <div style={{ color: '#8d7cff', fontSize: 11, letterSpacing: '.16em', fontWeight: 800 }}>OZLIND AI</div>
        <h1 style={{ margin: '10px 0', fontSize: 34, letterSpacing: '-.04em' }}>Page not found</h1>
        <p style={{ margin: '0 0 20px', color: '#a0a7b0', lineHeight: 1.6 }}>The requested route does not exist.</p>
        <Link href="/" style={{ color: '#090a0d', background: '#f4f6f8', padding: '10px 14px', borderRadius: 10, textDecoration: 'none', fontWeight: 750, fontSize: 12 }}>Return to OZLIND</Link>
      </section>
    </main>
  );
}
