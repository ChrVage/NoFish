export default function Footer() {
  return (
    <footer className="bg-ocean-900 text-center py-3 px-4 flex flex-row gap-6 items-center justify-center">
      <a
        href="https://github.com/ChrVage/NoFish/blob/main/README.md"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-ocean-100 hover:text-white underline underline-offset-4 decoration-ocean-400 hover:decoration-white transition-colors py-1"
      >
        About NoFish
      </a>
      <a
        href="https://github.com/ChrVage/NoFish/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-ocean-100 hover:text-white underline underline-offset-4 decoration-ocean-400 hover:decoration-white transition-colors py-1"
      >
        Feedback
      </a>
    </footer>
  );
}
