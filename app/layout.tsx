// Minimal root layout — the real layout lives in app/[locale]/layout.tsx
// This shell is required by Next.js App Router but contains no HTML
// (the locale layout renders the <html> element).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
