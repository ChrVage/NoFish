export default function Footer() {
  return (
    <footer className="bg-ocean-900 text-ocean-200 text-center py-3 px-4 text-xs flex flex-col gap-1 items-center sm:flex-row sm:justify-center sm:gap-4">
      <a
        href="https://github.com/ChrVage/NoFish/blob/main/README.md"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white underline underline-offset-2"
      >
        About NoFish — README on GitHub
      </a>
      <a
        href="https://github.com/ChrVage/NoFish/issues/new/choose"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white underline underline-offset-2"
      >
        Feedback / Report an issue
      </a>
    </footer>
  );
}
