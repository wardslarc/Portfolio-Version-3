// Cached so the page can stay prerendered; it's recomputed when the cache revalidates.
export default async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}
