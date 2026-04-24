import Header from '@/components/Header';
import Image from 'next/image';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Image src="/NoFish-logo.png" alt="NoFish" width={32} height={32} className="rounded-full" />
          <h1 className="text-lg font-bold">NoFish</h1>
        </div>
      </Header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maritime-teal-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-maritime-teal-700 mb-2">
            Loading scores...
          </h2>
          <p className="text-gray-600">Please wait</p>
        </div>
      </main>
    </div>
  );
}
